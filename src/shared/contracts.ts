import { z } from 'zod'
import {
  BOOKMARK_DOCUMENT_FIELD_ERROR_LIMIT,
  BOOKMARK_DOCUMENT_FIELD_PATH_LIMIT,
  BOOKMARKS_PER_SECTION_LIMIT,
  BOOKMARK_SECTION_LIMIT,
  BOOKMARK_TOTAL_LIMIT,
  BOOKMARK_URL_LIMIT,
  bookmarkDocumentSchema,
  bookmarkRevisionSchema,
  type BookmarkDocumentFieldError,
  type BookmarkDocumentV1,
} from './bookmarkDocument.js'

export const issueCodeSchema = z.enum([
  'invalid-configuration',
  'missing-configuration',
  'permission-denied',
  'location-unavailable',
  'timeout',
  'rate-limited',
  'upstream-unavailable',
  'invalid-upstream-payload',
  'partial-data',
])

export const apiIssueSchema = z.object({
  code: issueCodeSchema,
  message: z.string().min(1).max(240),
  retryable: z.boolean(),
})

export const locationProvenanceSchema = z.object({
  kind: z.enum(['current', 'last-known', 'home']),
  label: z.string().min(1).max(100),
  capturedAt: z.iso.datetime().nullable(),
})

export const apiMetaSchema = z.object({
  generatedAt: z.iso.datetime(),
  sourceUpdatedAt: z.iso.datetime().nullable(),
  freshness: z.enum(['fresh', 'stale']),
  staleAfterMs: z.number().int().positive(),
  issues: z.array(apiIssueSchema),
  location: locationProvenanceSchema.optional(),
})

export function widgetEnvelopeSchema<T extends z.ZodType>(data: T) {
  return z.object({ schemaVersion: z.literal(1), data, meta: apiMetaSchema })
}

const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  capturedAt: z.iso.datetime(),
})

export const locationSelectorSchema = z.discriminatedUnion('kind', [
  coordinatesSchema.extend({ kind: z.literal('current') }),
  coordinatesSchema.extend({ kind: z.literal('last-known') }),
  z.object({ kind: z.literal('home') }),
])

export type LocationSelector = z.infer<typeof locationSelectorSchema>
export type LocationProvenance = z.infer<typeof locationProvenanceSchema>
export type ApiIssue = z.infer<typeof apiIssueSchema>
export type ApiMeta = z.infer<typeof apiMetaSchema>

export const forecastHourSchema = z.object({
  at: z.iso.datetime(),
  temperature: z.number(),
  condition: z.string().min(1).max(60),
  precipitationProbability: z.number().min(0).max(100).nullable(),
})

export const weatherSummarySchema = z.object({
  temperatureUnit: z.enum(['fahrenheit', 'celsius']),
  timeZone: z.string().min(1).max(80),
  currentTemperature: z.number(),
  apparentTemperature: z.number().nullable(),
  condition: z.string().min(1).max(60),
  high: z.number(),
  low: z.number(),
  precipitationProbability: z.number().min(0).max(100).nullable(),
  windSpeed: z.number().nonnegative().nullable(),
  sunrise: z.iso.datetime(),
  sunset: z.iso.datetime(),
  daylightMinutes: z.number().int().nonnegative(),
  nextDaylightEvent: z.object({ kind: z.enum(['sunrise', 'sunset']), at: z.iso.datetime() }),
  hourly: z.array(forecastHourSchema).max(5),
})

export const bookmarkUrlSchema = z
  .url()
  .refine((value) => [...value].length <= BOOKMARK_URL_LIMIT, {
    message: `Bookmark URL must contain no more than ${BOOKMARK_URL_LIMIT} characters.`,
  })
  .refine(
    (value) => {
      try {
        const url = new URL(value)
        return (
          (url.protocol === 'http:' || url.protocol === 'https:') &&
          url.username === '' &&
          url.password === ''
        )
      } catch {
        return false
      }
    },
    { message: 'Bookmark URL must use HTTP or HTTPS without credentials.' },
  )

export const bookmarkSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{16}$/),
  group: z.string().min(1).max(40),
  name: z.string().min(1).max(100),
  url: bookmarkUrlSchema,
  order: z.number().int().nonnegative(),
})

export const bookmarksSummarySchema = z
  .object({
    sections: z.array(z.string().min(1).max(40)).max(BOOKMARK_SECTION_LIMIT),
    bookmarks: z.array(bookmarkSchema).max(BOOKMARK_TOTAL_LIMIT),
    invalidEntryCount: z.number().int().nonnegative(),
  })
  .superRefine((summary, context) => {
    const sectionNames = new Set<string>()
    summary.sections.forEach((section, index) => {
      if (sectionNames.has(section)) {
        context.addIssue({
          code: 'custom',
          path: ['sections', index],
          message: 'Bookmark sections must be unique.',
        })
      }
      sectionNames.add(section)
    })
    summary.bookmarks.forEach((bookmark, index) => {
      if (!sectionNames.has(bookmark.group)) {
        context.addIssue({
          code: 'custom',
          path: ['bookmarks', index, 'group'],
          message: 'Every bookmark must belong to a listed section.',
        })
      }
    })
    for (const section of summary.sections) {
      if (
        summary.bookmarks.filter((bookmark) => bookmark.group === section).length >
        BOOKMARKS_PER_SECTION_LIMIT
      ) {
        context.addIssue({
          code: 'custom',
          path: ['bookmarks'],
          message: `A section can contain up to ${BOOKMARKS_PER_SECTION_LIMIT} bookmarks.`,
        })
        break
      }
    }
  })

export const ebirdTargetSchema = z.object({
  speciesCode: z.string().min(1).max(24),
  commonName: z.string().min(1).max(120),
  observedAt: z.iso.datetime(),
  locality: z.string().min(1).max(180),
  distanceKm: z.number().nonnegative().nullable(),
})

export const ebirdSummarySchema = z.object({
  radiusKm: z.number().positive(),
  windowDays: z.number().int().positive(),
  targets: z.object({
    lifer: z.array(ebirdTargetSchema),
    photo: z.array(ebirdTargetSchema),
    audio: z.array(ebirdTargetSchema),
  }),
  targetAvailability: z.object({
    lifer: z.boolean(),
    photo: z.boolean(),
    audio: z.boolean(),
  }),
  month: z.object({
    label: z.string().min(1).max(40),
    throughDay: z.number().int().min(1).max(31),
    currentCount: z.number().int().nonnegative(),
    previousCount: z.number().int().nonnegative(),
    difference: z.number().int(),
  }),
  nearbyUpdatedAt: z.iso.datetime(),
  profileUpdatedAt: z.iso.datetime(),
})

export const limitWindowSchema = z.object({
  remainingPct: z.number().min(0).max(100),
  resetsAt: z.iso.datetime().nullable(),
  capturedAt: z.iso.datetime(),
})

export const llmProviderSchema = z.object({
  id: z.enum(['claude', 'codex']),
  label: z.string().min(1).max(60),
  fiveHour: limitWindowSchema.nullable(),
  weekly: limitWindowSchema.nullable(),
  diagnostic: z.string().min(1).max(80).nullable(),
})

export const llmdashSummarySchema = z.object({
  providers: z.array(llmProviderSchema).length(2),
  generatedAt: z.iso.datetime(),
})

export const weatherEnvelopeSchema = widgetEnvelopeSchema(weatherSummarySchema)
export const bookmarksEnvelopeSchema = widgetEnvelopeSchema(bookmarksSummarySchema)
const legacyBookmarksEnvelopeSchema = widgetEnvelopeSchema(
  z
    .object({
      bookmarks: z.array(bookmarkSchema).max(BOOKMARK_TOTAL_LIMIT),
      invalidEntryCount: z.number().int().nonnegative(),
    })
    .strict(),
)
export const storedBookmarksEnvelopeSchema = z.union([
  bookmarksEnvelopeSchema,
  legacyBookmarksEnvelopeSchema
    .transform((envelope) => ({
      ...envelope,
      data: {
        ...envelope.data,
        sections: [...new Set(envelope.data.bookmarks.map((bookmark) => bookmark.group))],
      },
    }))
    .pipe(bookmarksEnvelopeSchema),
])
export const ebirdEnvelopeSchema = widgetEnvelopeSchema(ebirdSummarySchema)
export const llmdashEnvelopeSchema = widgetEnvelopeSchema(llmdashSummarySchema)

export const apiErrorSchema = z.object({
  schemaVersion: z.literal(1),
  code: issueCodeSchema,
  message: z.string().min(1).max(240),
  retryable: z.boolean(),
})

export type WeatherSummary = z.infer<typeof weatherSummarySchema>
export type BookmarksSummary = z.infer<typeof bookmarksSummarySchema>
export type Bookmark = z.infer<typeof bookmarkSchema>
export type EbirdTarget = z.infer<typeof ebirdTargetSchema>
export type EbirdSummary = z.infer<typeof ebirdSummarySchema>
export type LlmdashSummary = z.infer<typeof llmdashSummarySchema>
export type WeatherEnvelope = z.infer<typeof weatherEnvelopeSchema>
export type BookmarksEnvelope = z.infer<typeof bookmarksEnvelopeSchema>
export type EbirdEnvelope = z.infer<typeof ebirdEnvelopeSchema>
export type LlmdashEnvelope = z.infer<typeof llmdashEnvelopeSchema>

export const replaceBookmarkDocumentRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    baseRevision: bookmarkRevisionSchema,
    document: z.unknown(),
  })
  .strict()

export const bookmarkDocumentResponseSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: bookmarkRevisionSchema,
    document: bookmarkDocumentSchema,
    display: bookmarksEnvelopeSchema,
  })
  .strict()

export const bookmarkDocumentErrorCodeSchema = z.enum([
  'bookmark-request-invalid',
  'bookmark-request-forbidden',
  'bookmark-request-too-large',
  'bookmark-media-type-unsupported',
  'bookmark-document-invalid',
  'bookmark-revision-conflict',
  'bookmark-source-invalid',
  'bookmark-source-unavailable',
  'bookmark-write-failed',
])

export const bookmarkDocumentErrorResponseSchema = z
  .object({
    schemaVersion: z.literal(1),
    code: bookmarkDocumentErrorCodeSchema,
    message: z.string().min(1).max(240),
    retryable: z.boolean(),
    fieldErrors: z
      .array(
        z.object({
          path: z.string().max(BOOKMARK_DOCUMENT_FIELD_PATH_LIMIT),
          code: z.enum([
            'required',
            'too-long',
            'control-character',
            'duplicate',
            'invalid-url',
            'too-many',
            'unknown-property',
            'unsupported-version',
          ]),
          message: z.string().min(1).max(160),
        }),
      )
      .max(BOOKMARK_DOCUMENT_FIELD_ERROR_LIMIT)
      .optional(),
  })
  .strict()

export type BookmarkDocumentResponse = z.infer<typeof bookmarkDocumentResponseSchema>
export type BookmarkDocumentErrorResponse = z.infer<typeof bookmarkDocumentErrorResponseSchema>
export type ReplaceBookmarkDocumentRequest = z.infer<typeof replaceBookmarkDocumentRequestSchema>
export type { BookmarkDocumentFieldError, BookmarkDocumentV1 }

export const preferencesSchema = z.object({
  schemaVersion: z.literal(1),
  mode: z.enum(['dawn', 'dense']),
  appearance: z.enum(['system', 'light', 'dark']),
})

export const storedLocationSchema = z.object({
  schemaVersion: z.literal(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  capturedAt: z.iso.datetime(),
})

export type DevicePreferences = z.infer<typeof preferencesSchema>
export type StoredLocation = z.infer<typeof storedLocationSchema>

export const DEFAULT_PREFERENCES: DevicePreferences = {
  schemaVersion: 1,
  mode: 'dawn',
  appearance: 'system',
}
