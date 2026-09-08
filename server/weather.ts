import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { WeatherEnvelope } from '../src/shared/contracts.js'
import type { AppConfig } from './config.js'
import { MemoryCache } from './cache.js'
import { asSourceError } from './errors.js'
import { fetchWithTimeout } from './fetch.js'
import type { FetchLike, ResolvedLocation } from './types.js'

const openMeteoSchema = z.object({
  utc_offset_seconds: z.number().int(),
  timezone: z.string().min(1),
  current: z.object({
    time: z.number(),
    temperature_2m: z.number(),
    apparent_temperature: z.number().nullable().optional(),
    weather_code: z.number().int(),
    wind_speed_10m: z.number().nonnegative().nullable().optional(),
  }),
  hourly: z.object({
    time: z.array(z.number()),
    temperature_2m: z.array(z.number()),
    weather_code: z.array(z.number()),
    precipitation_probability: z.array(z.number().nullable()),
  }),
  daily: z.object({
    time: z.array(z.number()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_probability_max: z.array(z.number().nullable()),
    sunrise: z.array(z.number()),
    sunset: z.array(z.number()),
  }),
})

const WEATHER_STALE_MS = 30 * 60_000
const WEATHER_CACHE_MS = 10 * 60_000

const descriptions = new Map<number, string>([
  [0, 'Clear sky'],
  [1, 'Mainly clear'],
  [2, 'Partly cloudy'],
  [3, 'Overcast'],
  [45, 'Fog'],
  [48, 'Rime fog'],
  [51, 'Light drizzle'],
  [53, 'Drizzle'],
  [55, 'Heavy drizzle'],
  [61, 'Light rain'],
  [63, 'Rain'],
  [65, 'Heavy rain'],
  [71, 'Light snow'],
  [73, 'Snow'],
  [75, 'Heavy snow'],
  [80, 'Rain showers'],
  [81, 'Rain showers'],
  [82, 'Heavy showers'],
  [85, 'Snow showers'],
  [86, 'Heavy snow showers'],
  [95, 'Thunderstorms'],
  [96, 'Thunderstorms with hail'],
  [99, 'Thunderstorms with hail'],
])

export function weatherCondition(code: number) {
  return descriptions.get(code) ?? 'Mixed conditions'
}

function locationKey(location: ResolvedLocation, unit: string) {
  return createHash('sha256')
    .update(`${location.latitude.toFixed(2)}:${location.longitude.toFixed(2)}:${unit}`)
    .digest('hex')
    .slice(0, 20)
}

function epochToIso(epochSeconds: number) {
  return new Date(epochSeconds * 1000).toISOString()
}

export class WeatherService {
  private readonly cache = new MemoryCache<WeatherEnvelope>()

  constructor(
    private readonly config: AppConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async load(location: ResolvedLocation, force = false): Promise<WeatherEnvelope> {
    const key = locationKey(location, this.config.temperatureUnit)
    const previous = this.cache.get(key)
    try {
      return await this.cache.load(key, WEATHER_CACHE_MS, force, async () => {
        const query = new URLSearchParams({
          latitude: String(location.latitude),
          longitude: String(location.longitude),
          current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
          hourly: 'temperature_2m,weather_code,precipitation_probability',
          daily:
            'temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
          temperature_unit: this.config.temperatureUnit,
          wind_speed_unit: this.config.temperatureUnit === 'fahrenheit' ? 'mph' : 'kmh',
          forecast_days: '2',
          timezone: 'auto',
          timeformat: 'unixtime',
        })
        const response = await fetchWithTimeout(
          this.fetchImpl,
          `https://api.open-meteo.com/v1/forecast?${query}`,
          { headers: { accept: 'application/json' } },
          this.config.upstreamTimeoutMs,
          'Open-Meteo',
        )
        const parsed = openMeteoSchema.safeParse(await response.json())
        if (!parsed.success) throw new Error('invalid-weather-payload')

        const source = parsed.data
        const nowSeconds = Date.now() / 1000
        const startIndex = Math.max(
          0,
          source.hourly.time.findIndex((time) => time >= nowSeconds - 1800),
        )
        const hourly = source.hourly.time.slice(startIndex, startIndex + 5).map((at, offset) => {
          const index = startIndex + offset
          return {
            at: epochToIso(at),
            temperature: source.hourly.temperature_2m[index] ?? source.current.temperature_2m,
            condition: weatherCondition(
              source.hourly.weather_code[index] ?? source.current.weather_code,
            ),
            precipitationProbability: source.hourly.precipitation_probability[index] ?? null,
          }
        })

        const todaySunrise = source.daily.sunrise[0]
        const todaySunset = source.daily.sunset[0]
        const tomorrowSunrise = source.daily.sunrise[1] ?? todaySunrise + 86_400
        const nextDaylightEvent =
          nowSeconds < todaySunrise
            ? { kind: 'sunrise' as const, at: epochToIso(todaySunrise) }
            : nowSeconds < todaySunset
              ? { kind: 'sunset' as const, at: epochToIso(todaySunset) }
              : { kind: 'sunrise' as const, at: epochToIso(tomorrowSunrise) }

        const generatedAt = new Date().toISOString()
        return {
          schemaVersion: 1,
          data: {
            temperatureUnit: this.config.temperatureUnit,
            timeZone: source.timezone,
            currentTemperature: source.current.temperature_2m,
            apparentTemperature: source.current.apparent_temperature ?? null,
            condition: weatherCondition(source.current.weather_code),
            high: source.daily.temperature_2m_max[0],
            low: source.daily.temperature_2m_min[0],
            precipitationProbability: source.daily.precipitation_probability_max[0] ?? null,
            windSpeed: source.current.wind_speed_10m ?? null,
            sunrise: epochToIso(todaySunrise),
            sunset: epochToIso(todaySunset),
            daylightMinutes: Math.max(0, Math.round((todaySunset - todaySunrise) / 60)),
            nextDaylightEvent,
            hourly,
          },
          meta: {
            generatedAt,
            sourceUpdatedAt: epochToIso(source.current.time),
            freshness: 'fresh',
            staleAfterMs: WEATHER_STALE_MS,
            issues: [],
            location: location.provenance,
          },
        }
      })
    } catch (error) {
      if (previous) {
        const sourceError = asSourceError(error, 'Weather could not be refreshed.')
        return {
          ...previous.value,
          meta: {
            ...previous.value.meta,
            freshness: 'stale',
            issues: [
              {
                code: sourceError.code,
                message: 'Showing the last weather reading because refresh failed.',
                retryable: sourceError.retryable,
              },
            ],
          },
        }
      }
      throw asSourceError(error, 'Weather could not be reached.')
    }
  }
}
