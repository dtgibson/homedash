import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { parse } from 'csv-parse'
import { z } from 'zod'
import type { ApiIssue, EbirdEnvelope, EbirdTarget } from '../src/shared/contracts.js'
import type { AppConfig } from './config.js'
import { MemoryCache } from './cache.js'
import { asSourceError, SourceError } from './errors.js'
import { fetchWithTimeout } from './fetch.js'
import type { FetchLike, ResolvedLocation } from './types.js'

const metadataEntrySchema = z.object({ filename: z.string(), uploadedAt: z.iso.datetime() })
const metadataSchema = z.object({
  ebird: metadataEntrySchema.nullable(),
  ml: metadataEntrySchema.nullable(),
})

const taxonomySchema = z.object({ codes: z.record(z.string(), z.string()) })

const recentObservationSchema = z.object({
  speciesCode: z.string().min(1),
  comName: z.string().min(1),
  locName: z.string().min(1),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  recentDate: z.string().min(10),
})

interface SpeciesName {
  commonName: string
  scientificName: string
}

interface DatedObservation extends SpeciesName {
  date: string
}

interface MediaObservation extends SpeciesName {
  format: 'Photo' | 'Audio' | 'Video'
}

interface PersonalProfile {
  seen: Set<string>
  photo: Set<string>
  audio: Set<string>
  observations: Array<{ speciesCode: string; date: string }>
  updatedAt: string
  mediaAvailable: boolean
}

export function classifyTargetCategories(
  targets: readonly SortableTarget[],
  profile: Pick<PersonalProfile, 'seen' | 'photo' | 'audio' | 'mediaAvailable'>,
  limit: number,
) {
  const sorted = dedupeSortTargets(targets)
  return {
    lifer: sorted.filter((target) => !profile.seen.has(target.speciesCode)).slice(0, limit),
    photo: profile.mediaAvailable
      ? sorted.filter((target) => !profile.photo.has(target.speciesCode)).slice(0, limit)
      : [],
    audio: profile.mediaAvailable
      ? sorted.filter((target) => !profile.audio.has(target.speciesCode)).slice(0, limit)
      : [],
  }
}

export type SortableTarget = EbirdTarget

function observedEpoch(target: SortableTarget) {
  const value = Date.parse(target.observedAt)
  return Number.isFinite(value) ? value : 0
}

/**
 * The product's load-bearing target rule. Canonical species are collapsed first;
 * a known shortest distance always beats an unknown one, and recency is consulted
 * only when distances are equal. The caller applies its display cap afterward.
 */
export function dedupeSortTargets(targets: readonly SortableTarget[]): SortableTarget[] {
  const bySpecies = new Map<string, SortableTarget>()
  for (const target of targets) {
    const current = bySpecies.get(target.speciesCode)
    if (!current || compareTargets(target, current) < 0) bySpecies.set(target.speciesCode, target)
  }
  return [...bySpecies.values()].sort(compareTargets)
}

function compareTargets(a: SortableTarget, b: SortableTarget) {
  const aDistance =
    typeof a.distanceKm === 'number' && Number.isFinite(a.distanceKm) ? a.distanceKm : Infinity
  const bDistance =
    typeof b.distanceKm === 'number' && Number.isFinite(b.distanceKm) ? b.distanceKm : Infinity
  if (aDistance !== bDistance) return aDistance - bDistance
  return observedEpoch(b) - observedEpoch(a)
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = radians(lat2 - lat1)
  const dLon = radians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toObservationIso(value: string) {
  const normalized = value.trim().replace(' ', 'T')
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)
    ? `${normalized}:00`
    : normalized
  const epoch = Date.parse(
    /(?:Z|[+-]\d\d:\d\d)$/.test(withSeconds) ? withSeconds : `${withSeconds}Z`,
  )
  if (!Number.isFinite(epoch)) throw new Error('invalid-observation-time')
  return new Date(epoch).toISOString()
}

function rowValue(row: Record<string, string>, ...names: string[]) {
  const entries = Object.entries(row)
  for (const name of names) {
    const match = entries.find(([key]) => key.trim().toLowerCase() === name.toLowerCase())
    if (match) return match[1]?.trim() ?? ''
  }
  return ''
}

async function parseCsvResponse<T>(
  response: Response,
  map: (row: Record<string, string>) => T | null,
) {
  if (!response.body) throw new Error('empty-csv-response')
  const parser = parse({
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })
  const stream = Readable.fromWeb(response.body as never).pipe(parser)
  const rows: T[] = []
  for await (const candidate of stream) {
    const mapped = map(candidate as Record<string, string>)
    if (mapped) rows.push(mapped)
  }
  return rows
}

function getTodayParts(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const number = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  return { year: number('year'), month: number('month'), day: number('day') }
}

function isoDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function monthComparison(
  observations: PersonalProfile['observations'],
  timeZone: string,
  now = new Date(),
) {
  const today = getTodayParts(timeZone, now)
  const previousDay = Math.min(today.day, daysInMonth(today.year - 1, today.month))
  const currentStart = isoDate(today.year, today.month, 1)
  const currentEnd = isoDate(today.year, today.month, today.day)
  const previousStart = isoDate(today.year - 1, today.month, 1)
  const previousEnd = isoDate(today.year - 1, today.month, previousDay)
  const current = new Set<string>()
  const previous = new Set<string>()
  for (const observation of observations) {
    if (observation.date >= currentStart && observation.date <= currentEnd) {
      current.add(observation.speciesCode)
    }
    if (observation.date >= previousStart && observation.date <= previousEnd) {
      previous.add(observation.speciesCode)
    }
  }
  const label = new Intl.DateTimeFormat('en-US', { timeZone, month: 'long' }).format(now)
  return {
    label,
    throughDay: today.day,
    currentCount: current.size,
    previousCount: previous.size,
    difference: current.size - previous.size,
  }
}

function validTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export class EbirdService {
  private metadataCache: { value: z.infer<typeof metadataSchema>; expiresAt: number } | null = null
  private profileCache: { key: string; value: PersonalProfile } | null = null
  private readonly nearbyCache = new MemoryCache<EbirdTarget[]>()
  private readonly envelopeCache = new Map<string, EbirdEnvelope>()

  constructor(
    private readonly config: AppConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async load(location: ResolvedLocation, timeZone: string, force = false): Promise<EbirdEnvelope> {
    if (!validTimeZone(timeZone)) {
      throw new SourceError(
        'invalid-configuration',
        'The device time zone is not valid.',
        false,
        400,
      )
    }
    const cacheKey = createHash('sha256')
      .update(`${location.latitude.toFixed(2)}:${location.longitude.toFixed(2)}:${timeZone}`)
      .digest('hex')
      .slice(0, 20)
    const previous = this.envelopeCache.get(cacheKey)

    try {
      const [profile, nearby] = await Promise.all([
        this.loadProfile(force),
        this.loadNearby(location, force),
      ])
      const limit = this.config.ebirdTargetLimit
      const issues: ApiIssue[] = []
      if (!profile.mediaAvailable) {
        issues.push({
          code: 'partial-data',
          message: 'SnowRaven has no Macaulay export, so photo and audio targets are unavailable.',
          retryable: false,
        })
      }

      const targets = classifyTargetCategories(nearby, profile, limit)
      const stale = Date.now() - Date.parse(profile.updatedAt) > 6 * 60 * 60_000
      const generatedAt = new Date().toISOString()
      const envelope: EbirdEnvelope = {
        schemaVersion: 1,
        data: {
          radiusKm: this.config.ebirdRadiusKm,
          windowDays: this.config.ebirdWindowDays,
          targets,
          targetAvailability: {
            lifer: true,
            photo: profile.mediaAvailable,
            audio: profile.mediaAvailable,
          },
          month: monthComparison(profile.observations, timeZone),
          nearbyUpdatedAt: generatedAt,
          profileUpdatedAt: profile.updatedAt,
        },
        meta: {
          generatedAt,
          sourceUpdatedAt: profile.updatedAt,
          freshness: stale ? 'stale' : 'fresh',
          staleAfterMs: 6 * 60 * 60_000,
          issues,
          location: location.provenance,
        },
      }
      this.envelopeCache.set(cacheKey, envelope)
      return envelope
    } catch (error) {
      if (previous) {
        const sourceError = asSourceError(error, 'eBird data could not be refreshed.')
        return {
          ...previous,
          meta: {
            ...previous.meta,
            freshness: 'stale',
            issues: [
              {
                code: sourceError.code,
                message: 'Showing the last eBird reading because refresh failed.',
                retryable: sourceError.retryable,
              },
            ],
          },
        }
      }
      throw asSourceError(error, 'SnowRaven could not provide eBird data.')
    }
  }

  private async metadata(force: boolean) {
    if (!force && this.metadataCache && this.metadataCache.expiresAt > Date.now()) {
      return this.metadataCache.value
    }
    const response = await fetchWithTimeout(
      this.fetchImpl,
      `${this.config.snowRavenUrl}/settings/files`,
      { headers: { accept: 'application/json' } },
      this.config.upstreamTimeoutMs,
      'SnowRaven',
    )
    const result = metadataSchema.safeParse(await response.json())
    if (!result.success) {
      throw new SourceError(
        'invalid-upstream-payload',
        'SnowRaven file metadata is unreadable.',
        true,
      )
    }
    this.metadataCache = { value: result.data, expiresAt: Date.now() + 15 * 60_000 }
    return result.data
  }

  private async loadProfile(force: boolean): Promise<PersonalProfile> {
    const metadata = await this.metadata(force)
    if (!metadata.ebird) {
      throw new SourceError(
        'missing-configuration',
        'SnowRaven needs a My eBird Data export before targets can be calculated.',
        false,
        503,
      )
    }
    const key = `${metadata.ebird.uploadedAt}:${metadata.ml?.uploadedAt ?? 'no-media'}`
    if (this.profileCache?.key === key) return this.profileCache.value

    const ebirdResponse = await fetchWithTimeout(
      this.fetchImpl,
      `${this.config.snowRavenUrl}/settings/files/ebird`,
      { headers: { accept: 'text/csv' } },
      this.config.upstreamTimeoutMs,
      'SnowRaven eBird export',
    )
    const dated = await parseCsvResponse<DatedObservation>(ebirdResponse, (row) => {
      const commonName = rowValue(row, 'Common Name')
      const date = rowValue(row, 'Date')
      if (!commonName || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
      return { commonName, scientificName: rowValue(row, 'Scientific Name'), date }
    })
    if (!dated.length) {
      throw new SourceError(
        'invalid-upstream-payload',
        'The SnowRaven eBird export has no usable rows.',
        false,
      )
    }

    let media: MediaObservation[] = []
    if (metadata.ml) {
      const mlResponse = await fetchWithTimeout(
        this.fetchImpl,
        `${this.config.snowRavenUrl}/settings/files/ml`,
        { headers: { accept: 'text/csv' } },
        this.config.upstreamTimeoutMs,
        'SnowRaven Macaulay export',
      )
      media = await parseCsvResponse<MediaObservation>(mlResponse, (row) => {
        const commonName = rowValue(row, 'Common Name')
        const format = rowValue(row, 'Format')
        if (!commonName || !['Photo', 'Audio', 'Video'].includes(format)) return null
        return {
          commonName,
          scientificName: rowValue(row, 'Scientific Name'),
          format: format as MediaObservation['format'],
        }
      })
    }

    const names = new Map<string, SpeciesName>()
    for (const row of [...dated, ...media]) names.set(row.commonName, row)
    const codes = await this.taxonomyCodes([...names.values()])
    const seen = new Set<string>()
    const photo = new Set<string>()
    const audio = new Set<string>()
    const observations: PersonalProfile['observations'] = []
    for (const row of dated) {
      const speciesCode = codes[row.commonName]
      if (!speciesCode) continue
      seen.add(speciesCode)
      observations.push({ speciesCode, date: row.date })
    }
    for (const row of media) {
      const speciesCode = codes[row.commonName]
      if (!speciesCode) continue
      if (row.format === 'Photo') photo.add(speciesCode)
      if (row.format === 'Audio') audio.add(speciesCode)
    }

    const updatedAt = [metadata.ebird.uploadedAt, metadata.ml?.uploadedAt]
      .filter((value): value is string => Boolean(value))
      .sort()[0]
    const value: PersonalProfile = {
      seen,
      photo,
      audio,
      observations,
      updatedAt,
      mediaAvailable: Boolean(metadata.ml),
    }
    this.profileCache = { key, value }
    return value
  }

  private async taxonomyCodes(names: SpeciesName[]) {
    const codes: Record<string, string> = Object.create(null) as Record<string, string>
    for (let start = 0; start < names.length; start += 500) {
      const response = await fetchWithTimeout(
        this.fetchImpl,
        `${this.config.snowRavenUrl}/taxonomy/codes`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ species: names.slice(start, start + 500) }),
        },
        this.config.upstreamTimeoutMs,
        'SnowRaven taxonomy',
      )
      const parsed = taxonomySchema.safeParse(await response.json())
      if (!parsed.success) {
        throw new SourceError('invalid-upstream-payload', 'SnowRaven taxonomy is unreadable.', true)
      }
      for (const [name, code] of Object.entries(parsed.data.codes)) codes[name] = code
    }
    return codes
  }

  private async loadNearby(location: ResolvedLocation, force: boolean): Promise<EbirdTarget[]> {
    const key = createHash('sha256')
      .update(
        `${location.latitude.toFixed(2)}:${location.longitude.toFixed(2)}:${this.config.ebirdRadiusKm}`,
      )
      .digest('hex')
      .slice(0, 20)
    return this.nearbyCache.load(key, 15 * 60_000, force, async () => {
      const query = new URLSearchParams({
        lat: String(location.latitude),
        lng: String(location.longitude),
        dist: String(this.config.ebirdRadiusKm),
      })
      const response = await fetchWithTimeout(
        this.fetchImpl,
        `${this.config.snowRavenUrl}/map/recent-obs?${query}`,
        { headers: { accept: 'application/json' } },
        this.config.upstreamTimeoutMs,
        'SnowRaven nearby observations',
      )
      const parsed = z.array(recentObservationSchema).safeParse(await response.json())
      if (!parsed.success) {
        throw new SourceError(
          'invalid-upstream-payload',
          'SnowRaven nearby observations are unreadable.',
          true,
        )
      }
      const cutoff = Date.now() - this.config.ebirdWindowDays * 86_400_000
      const inWindow = parsed.data.filter((row) => {
        try {
          return Date.parse(toObservationIso(row.recentDate)) >= cutoff
        } catch {
          return false
        }
      })
      const codes = await this.taxonomyCodes(
        inWindow.map((row) => ({ commonName: row.comName, scientificName: '' })),
      )
      return inWindow.flatMap((row) => {
        const speciesCode = codes[row.comName] ?? row.speciesCode
        let observedAt: string
        try {
          observedAt = toObservationIso(row.recentDate)
        } catch {
          return []
        }
        const distanceKm =
          row.lat == null || row.lng == null
            ? null
            : Math.round(
                haversineKm(location.latitude, location.longitude, row.lat, row.lng) * 10,
              ) / 10
        return [
          {
            speciesCode,
            commonName: row.comName,
            observedAt,
            locality: row.locName,
            distanceKm,
          },
        ]
      })
    })
  }
}
