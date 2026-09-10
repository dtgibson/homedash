import { z } from 'zod'
import {
  tideEnvelopeSchema,
  type ApiIssue,
  type TideEnvelope,
  type TidePoint,
  type TideTurn,
} from '../src/shared/contracts.js'
import type { AppConfig } from './config.js'
import { MemoryCache } from './cache.js'
import { asSourceError, SourceError } from './errors.js'
import { fetchWithTimeout } from './fetch.js'
import type { FetchLike } from './types.js'

const NOAA_ENDPOINT = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'
const PROVIDER_BODY_LIMIT = 512 * 1024
const OBSERVATION_CACHE_MS = 5 * 60_000
const PREDICTION_CACHE_MS = 60 * 60_000
const TIDE_STALE_MS = 15 * 60_000
const OBSERVATION_MAX_AGE_MS = 60 * 60_000
const LAST_GOOD_LIMIT = 8

const providerPointSchema = z
  .object({
    t: z.string().min(1).max(40),
    v: z.string().min(1).max(40),
  })
  .strict()

const providerObservationPointSchema = providerPointSchema.extend({
  s: z.string().min(1).max(40),
  f: z.string().min(1).max(40),
  q: z.string().min(1).max(40),
})

const providerTurnSchema = providerPointSchema.extend({ type: z.enum(['H', 'L']) })

const observationResponseSchema = z
  .object({
    metadata: z
      .object({
        id: z.string().min(1).max(32),
        name: z.string().min(1).max(200),
        lat: z.string().min(1).max(40),
        lon: z.string().min(1).max(40),
      })
      .strict(),
    data: z.array(providerObservationPointSchema).max(1_000),
  })
  .strict()

const predictionResponseSchema = z
  .object({
    predictions: z.array(providerPointSchema).max(1_000),
  })
  .strict()

const turnResponseSchema = z
  .object({
    predictions: z.array(providerTurnSchema).max(1_000),
  })
  .strict()

interface PredictionBundle {
  points: TidePoint[]
  turns: TideTurn[]
}

function roundHeight(value: number) {
  return Math.round(value * 1_000) / 1_000
}

function providerTimeToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) throw new Error('invalid-tide-time')
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] ?? '00'}Z`
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) throw new Error('invalid-tide-time')
  const parsed = new Date(at)
  if (
    parsed.getUTCFullYear() !== Number(match[1]) ||
    parsed.getUTCMonth() + 1 !== Number(match[2]) ||
    parsed.getUTCDate() !== Number(match[3]) ||
    parsed.getUTCHours() !== Number(match[4]) ||
    parsed.getUTCMinutes() !== Number(match[5]) ||
    parsed.getUTCSeconds() !== Number(match[6] ?? '00')
  ) {
    throw new Error('invalid-tide-time')
  }
  return parsed.toISOString()
}

function parseHeight(value: string) {
  const heightFeet = Number(value)
  if (!Number.isFinite(heightFeet) || heightFeet < -100 || heightFeet > 100) {
    throw new Error('invalid-tide-height')
  }
  return roundHeight(heightFeet)
}

function assertChronological(points: Array<{ at: string }>) {
  let previous = Number.NEGATIVE_INFINITY
  for (const point of points) {
    const current = Date.parse(point.at)
    if (!Number.isFinite(current) || current <= previous) throw new Error('invalid-tide-order')
    previous = current
  }
}

function parsePoints(values: z.infer<typeof providerPointSchema>[]): TidePoint[] {
  const points = values.map((value) => ({
    at: providerTimeToIso(value.t),
    heightFeet: parseHeight(value.v),
  }))
  assertChronological(points)
  return points
}

function parseTurns(values: z.infer<typeof providerTurnSchema>[]): TideTurn[] {
  const turns = values.map((value) => ({
    kind: value.type === 'H' ? ('high' as const) : ('low' as const),
    at: providerTimeToIso(value.t),
    heightFeet: parseHeight(value.v),
  }))
  assertChronological(turns)
  return turns
}

function validTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0)
    return true
  } catch {
    return false
  }
}

function localDateKey(at: string | number | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(at))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function compactUtcDate(at: number) {
  return new Date(at).toISOString().slice(0, 10).replaceAll('-', '')
}

function requestWindow(now: number) {
  return {
    begin: compactUtcDate(now - 86_400_000),
    end: compactUtcDate(now + 2 * 86_400_000),
  }
}

async function boundedJson(response: Response) {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > PROVIDER_BODY_LIMIT) {
    throw new Error('tide-payload-too-large')
  }
  if (!response.body) throw new Error('invalid-tide-json')
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > PROVIDER_BODY_LIMIT) {
        await reader.cancel()
        throw new Error('tide-payload-too-large')
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return JSON.parse(text) as unknown
  } catch {
    if (size > PROVIDER_BODY_LIMIT) throw new Error('tide-payload-too-large')
    throw new Error('invalid-tide-json')
  }
}

function interpolateCurrent(points: TidePoint[], now: number) {
  const afterIndex = points.findIndex((point) => Date.parse(point.at) >= now)
  if (afterIndex <= 0) throw new Error('missing-current-prediction')
  const before = points[afterIndex - 1]
  const after = points[afterIndex]
  if (!before || !after) throw new Error('missing-current-prediction')
  const beforeAt = Date.parse(before.at)
  const afterAt = Date.parse(after.at)
  const progress = Math.max(0, Math.min(1, (now - beforeAt) / Math.max(1, afterAt - beforeAt)))
  return {
    at: new Date(now).toISOString(),
    heightFeet: roundHeight(before.heightFeet + (after.heightFeet - before.heightFeet) * progress),
    before,
    after,
  }
}

export function classifyTideDirection(changeFeet: number) {
  if (changeFeet >= 0.05) return 'rising' as const
  if (changeFeet <= -0.05) return 'falling' as const
  return 'near-slack' as const
}

function currentTide(observations: TidePoint[], predictions: TidePoint[], now: number) {
  const eligible = observations.filter((point) => {
    const at = Date.parse(point.at)
    return at <= now && now - at <= OBSERVATION_MAX_AGE_MS
  })
  const observation = eligible.at(-1)
  const predicted = interpolateCurrent(predictions, now)
  if (!observation) {
    return {
      at: predicted.at,
      heightFeet: predicted.heightFeet,
      basis: 'predicted' as const,
      direction: classifyTideDirection(predicted.after.heightFeet - predicted.before.heightFeet),
    }
  }

  const observationAt = Date.parse(observation.at)
  const comparison = [...eligible].reverse().find((point) => {
    const age = observationAt - Date.parse(point.at)
    return age >= 6 * 60_000 && age <= OBSERVATION_MAX_AGE_MS
  })
  return {
    ...observation,
    basis: 'observed' as const,
    direction: classifyTideDirection(
      comparison
        ? observation.heightFeet - comparison.heightFeet
        : predicted.after.heightFeet - predicted.before.heightFeet,
    ),
  }
}

function selectLocalDay<T extends { at: string }>(values: T[], timeZone: string, now: number) {
  const today = localDateKey(now, timeZone)
  return values.filter((value) => localDateKey(value.at, timeZone) === today)
}

function downsamplePredictions(points: TidePoint[], turns: TideTurn[], now: number) {
  const importantTimes = new Set<string>()
  const first = points[0]
  const last = points.at(-1)
  if (!first || !last) return []
  importantTimes.add(first.at)
  importantTimes.add(last.at)

  const atOrAfterNow = points.findIndex((point) => Date.parse(point.at) >= now)
  if (atOrAfterNow >= 0) {
    const before = points[Math.max(0, atOrAfterNow - 1)]
    const after = points[atOrAfterNow]
    if (before) importantTimes.add(before.at)
    if (after) importantTimes.add(after.at)
  }

  for (const point of points) {
    if (Date.parse(point.at) % (30 * 60_000) === 0) importantTimes.add(point.at)
  }

  const start = Date.parse(first.at)
  const end = Date.parse(last.at)
  const selected = new Map(
    points
      .filter((point) => importantTimes.has(point.at))
      .map((point) => [point.at, point] as const),
  )
  for (const turn of turns) {
    const at = Date.parse(turn.at)
    if (at >= start && at <= end) {
      selected.set(turn.at, { at: turn.at, heightFeet: turn.heightFeet })
    }
  }

  const result = [...selected.values()].sort(
    (left, right) => Date.parse(left.at) - Date.parse(right.at),
  )
  assertChronological(result)
  return result
}

function normalizeEnvelope(
  config: Extract<AppConfig['tide'], { status: 'ready' }>,
  predictions: PredictionBundle,
  observations: TidePoint[],
  observationIssue: ApiIssue | null,
  timeZone: string,
  now: number,
): TideEnvelope {
  const current = currentTide(observations, predictions.points, now)
  const nextTurn = predictions.turns.find((turn) => Date.parse(turn.at) > now)
  if (!nextTurn) throw new Error('missing-next-tide-turn')

  const localDayPoints = selectLocalDay(predictions.points, timeZone, now)
  const afterLocalDay = predictions.points.filter(
    (point) =>
      localDateKey(point.at, timeZone) !== localDateKey(now, timeZone) &&
      Date.parse(point.at) > Date.parse(localDayPoints.at(-1)?.at ?? ''),
  )
  const nextTurnOutsideDay = !selectLocalDay([nextTurn], timeZone, now).length
  const rolloverPoints = nextTurnOutsideDay
    ? afterLocalDay.filter((point) => Date.parse(point.at) <= Date.parse(nextTurn.at))
    : []
  const firstAfterTurn = nextTurnOutsideDay
    ? afterLocalDay.find((point) => Date.parse(point.at) > Date.parse(nextTurn.at))
    : undefined
  const fullWindow = [
    ...localDayPoints,
    ...rolloverPoints,
    ...(firstAfterTurn ? [firstAfterTurn] : []),
  ]
  const pointsForWindow = downsamplePredictions(fullWindow, predictions.turns, now)
  if (localDayPoints.length < 2 || pointsForWindow.length < 2 || pointsForWindow.length > 600) {
    throw new Error('invalid-local-tide-window')
  }
  const graphStart = Date.parse(fullWindow[0]?.at ?? '')
  const graphEnd = Date.parse(fullWindow.at(-1)?.at ?? '')
  const turnsInWindow = predictions.turns.filter((turn) => {
    const at = Date.parse(turn.at)
    return at >= graphStart && at <= graphEnd
  })
  const firstTurnAfterWindow = predictions.turns.find((turn) => Date.parse(turn.at) > graphEnd)
  const turns = [...turnsInWindow, ...(firstTurnAfterWindow ? [firstTurnAfterWindow] : [])].slice(
    0,
    16,
  )
  if (!turns.length) throw new Error('missing-local-tide-turns')

  const predictedFallback = current.basis === 'predicted'
  const issues = [
    ...(observationIssue ? [observationIssue] : []),
    ...(predictedFallback && !observationIssue
      ? [
          {
            code: 'partial-data' as const,
            message: 'The latest observation is unavailable; showing the predicted tide.',
            retryable: true,
          },
        ]
      : []),
  ]
  const generatedAt = new Date(now).toISOString()
  const candidate = {
    schemaVersion: 1 as const,
    data: {
      station: { label: config.stationLabel, datum: 'MLLW' as const, units: 'feet' as const },
      current,
      nextTurn,
      predictions: pointsForWindow,
      turns,
    },
    meta: {
      generatedAt,
      sourceUpdatedAt: current.basis === 'observed' ? current.at : null,
      freshness: issues.length ? ('partial' as const) : ('fresh' as const),
      staleAfterMs: TIDE_STALE_MS,
      issues,
    },
  }
  return tideEnvelopeSchema.parse(candidate)
}

export class TideService {
  private readonly observationCache = new MemoryCache<TidePoint[]>()
  private readonly predictionCache = new MemoryCache<PredictionBundle>()
  private readonly lastGood = new Map<string, TideEnvelope>()

  constructor(
    private readonly config: AppConfig,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async load(timeZone: string, force = false): Promise<TideEnvelope> {
    if (!validTimeZone(timeZone)) {
      throw new SourceError('invalid-configuration', 'The tide time zone is invalid.', false, 400)
    }
    if (this.config.tide.status !== 'ready') {
      const missing = this.config.tide.reason === 'missing-station'
      throw new SourceError(
        missing ? 'missing-configuration' : 'invalid-configuration',
        missing
          ? 'The local tide station is not configured.'
          : 'The local tide station configuration is invalid.',
        false,
        503,
      )
    }

    const now = this.now()
    const stationId = this.config.tide.stationId
    const previous = this.lastGood.get(timeZone)
    try {
      const predictionPromise = this.predictionCache.load(
        this.config.tide.stationId,
        PREDICTION_CACHE_MS,
        force,
        () => this.loadPredictions(now),
      )
      const observationPromise = this.observationCache
        .load(stationId, OBSERVATION_CACHE_MS, force, () => this.loadObservations(now, stationId))
        .then((value) => ({ status: 'fulfilled' as const, value }))
        .catch((error: unknown) => ({ status: 'rejected' as const, error }))

      const [predictions, observationResult] = await Promise.all([
        predictionPromise,
        observationPromise,
      ])
      const observationIssue =
        observationResult.status === 'rejected'
          ? {
              code: asSourceError(observationResult.error, 'Tide observations are unavailable.')
                .code,
              message: 'The latest observation is unavailable; showing the predicted tide.',
              retryable: true,
            }
          : null
      const envelope = normalizeEnvelope(
        this.config.tide,
        predictions,
        observationResult.status === 'fulfilled' ? observationResult.value : [],
        observationIssue,
        timeZone,
        now,
      )
      this.remember(timeZone, envelope)
      return envelope
    } catch (error) {
      if (previous) {
        const sourceError = asSourceError(error, 'Tide could not be refreshed.')
        return {
          ...previous,
          meta: {
            ...previous.meta,
            freshness: 'stale',
            issues: [
              {
                code: sourceError.code,
                message: 'Showing the last tide reading because refresh failed.',
                retryable: sourceError.retryable,
              },
            ],
          },
        }
      }
      throw asSourceError(error, 'Tide could not be reached.')
    }
  }

  private remember(timeZone: string, envelope: TideEnvelope) {
    if (!this.lastGood.has(timeZone) && this.lastGood.size >= LAST_GOOD_LIMIT) {
      const oldest = this.lastGood.keys().next().value
      if (oldest) this.lastGood.delete(oldest)
    }
    this.lastGood.delete(timeZone)
    this.lastGood.set(timeZone, envelope)
  }

  private async loadObservations(now: number, stationId: string) {
    const window = requestWindow(now)
    const response = await this.fetchProduct({
      product: 'water_level',
      begin_date: window.begin,
      end_date: window.end,
    })
    const parsed = observationResponseSchema.safeParse(await boundedJson(response))
    if (!parsed.success || parsed.data.metadata.id !== stationId || parsed.data.data.length === 0) {
      throw new Error('invalid-tide-observations')
    }
    return parsePoints(parsed.data.data)
  }

  private async loadPredictions(now: number): Promise<PredictionBundle> {
    const window = requestWindow(now)
    const [pointsResponse, turnsResponse] = await Promise.all([
      this.fetchProduct({
        product: 'predictions',
        begin_date: window.begin,
        end_date: window.end,
        interval: '6',
      }),
      this.fetchProduct({
        product: 'predictions',
        begin_date: window.begin,
        end_date: window.end,
        interval: 'hilo',
      }),
    ])
    const [pointsPayload, turnsPayload] = await Promise.all([
      boundedJson(pointsResponse),
      boundedJson(turnsResponse),
    ])
    const pointResult = predictionResponseSchema.safeParse(pointsPayload)
    const turnResult = turnResponseSchema.safeParse(turnsPayload)
    if (
      !pointResult.success ||
      !turnResult.success ||
      pointResult.data.predictions.length < 2 ||
      turnResult.data.predictions.length < 1
    ) {
      throw new Error('invalid-tide-predictions')
    }
    return {
      points: parsePoints(pointResult.data.predictions),
      turns: parseTurns(turnResult.data.predictions),
    }
  }

  private async fetchProduct(values: Record<string, string>) {
    const query = new URLSearchParams({
      ...values,
      station: this.config.tide.status === 'ready' ? this.config.tide.stationId : '',
      datum: 'MLLW',
      units: 'english',
      time_zone: 'gmt',
      application: 'homedash',
      format: 'json',
    })
    return fetchWithTimeout(
      this.fetchImpl,
      `${NOAA_ENDPOINT}?${query}`,
      { headers: { accept: 'application/json' } },
      this.config.upstreamTimeoutMs,
      'NOAA Tides & Currents',
    )
  }
}
