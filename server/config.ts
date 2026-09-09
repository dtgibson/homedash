import path from 'node:path'
import { z } from 'zod'

const optionalCoordinate = z.preprocess(
  (value) => (value === '' || value == null ? undefined : value),
  z.coerce.number().optional(),
)

type LlmdashLaunchDestination =
  { status: 'ready'; url: URL } | { status: 'unavailable'; reason: 'missing' | 'invalid' }

function parseAllowedOrigins(value: string | undefined, port: number) {
  const configured = value ?? `http://127.0.0.1:${port},http://127.0.0.1:5173`
  const origins = configured.split(',').map((entry) => entry.trim())
  if (!origins.length || origins.some((origin) => !origin)) {
    throw new Error('HOMEDASH_ALLOWED_ORIGINS must contain exact comma-separated origins.')
  }
  const canonical = origins.map((origin) => {
    let parsed: URL
    try {
      parsed = new URL(origin)
    } catch {
      throw new Error('HOMEDASH_ALLOWED_ORIGINS contains an invalid origin.')
    }
    const isLoopback = ['127.0.0.1', '[::1]', 'localhost'].includes(parsed.hostname)
    if (
      parsed.origin !== origin ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash ||
      (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopback))
    ) {
      throw new Error(
        'HOMEDASH_ALLOWED_ORIGINS must contain exact HTTPS origins or exact loopback HTTP origins.',
      )
    }
    return parsed.origin
  })
  return [...new Set(canonical)]
}

function parseLlmdashLaunchDestination(value: string | undefined): LlmdashLaunchDestination {
  if (value == null || value.trim() === '') return { status: 'unavailable', reason: 'missing' }
  try {
    const url = new URL(value)
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.hash
    ) {
      return { status: 'unavailable', reason: 'invalid' }
    }
    return { status: 'ready', url }
  } catch {
    return { status: 'unavailable', reason: 'invalid' }
  }
}

const envSchema = z
  .object({
    HOMEDASH_HOST: z.string().default('127.0.0.1'),
    HOMEDASH_PORT: z.coerce.number().int().min(1).max(65_535).default(1910),
    HOMEDASH_ALLOWED_ORIGINS: z.string().optional(),
    SNOWRAVEN_URL: z.url().default('http://127.0.0.1:1620'),
    LLMDASH_URL: z.url().default('http://127.0.0.1:8787'),
    LLMDASH_LAUNCH_URL: z.string().optional(),
    HOME_LATITUDE: optionalCoordinate,
    HOME_LONGITUDE: optionalCoordinate,
    HOME_LABEL: z.string().min(1).max(100).default('Home'),
    WEATHER_UNIT: z.enum(['fahrenheit', 'celsius']).default('fahrenheit'),
    EBIRD_RADIUS_KM: z.coerce.number().int().min(1).max(200).default(50),
    EBIRD_WINDOW_DAYS: z.coerce.number().int().min(1).max(30).default(14),
    EBIRD_TARGET_LIMIT: z.coerce.number().int().min(1).max(20).default(5),
    BOOKMARKS_PATH: z.string().default('./config/bookmarks.json'),
    UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(8_000),
  })
  .superRefine((value, context) => {
    if ((value.HOME_LATITUDE == null) !== (value.HOME_LONGITUDE == null)) {
      context.addIssue({
        code: 'custom',
        message: 'HOME_LATITUDE and HOME_LONGITUDE must be configured together.',
      })
    }
    if (value.HOME_LATITUDE != null && (value.HOME_LATITUDE < -90 || value.HOME_LATITUDE > 90)) {
      context.addIssue({ code: 'custom', message: 'HOME_LATITUDE is outside -90…90.' })
    }
    if (
      value.HOME_LONGITUDE != null &&
      (value.HOME_LONGITUDE < -180 || value.HOME_LONGITUDE > 180)
    ) {
      context.addIssue({ code: 'custom', message: 'HOME_LONGITUDE is outside -180…180.' })
    }
  })

export type AppConfig = ReturnType<typeof loadConfig>

export function loadConfig(source: NodeJS.ProcessEnv = process.env) {
  const value = envSchema.parse(source)
  return {
    host: value.HOMEDASH_HOST,
    port: value.HOMEDASH_PORT,
    bookmarkDocumentOrigins: parseAllowedOrigins(
      value.HOMEDASH_ALLOWED_ORIGINS,
      value.HOMEDASH_PORT,
    ),
    snowRavenUrl: value.SNOWRAVEN_URL.replace(/\/$/, ''),
    llmdashUrl: value.LLMDASH_URL.replace(/\/$/, ''),
    llmdashLaunch: parseLlmdashLaunchDestination(value.LLMDASH_LAUNCH_URL),
    home:
      value.HOME_LATITUDE == null || value.HOME_LONGITUDE == null
        ? null
        : {
            latitude: value.HOME_LATITUDE,
            longitude: value.HOME_LONGITUDE,
            label: value.HOME_LABEL,
          },
    temperatureUnit: value.WEATHER_UNIT,
    ebirdRadiusKm: value.EBIRD_RADIUS_KM,
    ebirdWindowDays: value.EBIRD_WINDOW_DAYS,
    ebirdTargetLimit: value.EBIRD_TARGET_LIMIT,
    bookmarksPath: path.resolve(value.BOOKMARKS_PATH),
    upstreamTimeoutMs: value.UPSTREAM_TIMEOUT_MS,
  }
}
