import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { z } from 'zod'
import type { BookmarksEnvelope } from '../src/shared/contracts.js'
import type { AppConfig } from './config.js'
import { SourceError } from './errors.js'

const entrySchema = z.object({
  name: z.string().trim().min(1).max(100),
  url: z.url().refine((url) => url.startsWith('http://') || url.startsWith('https://')),
  group: z.string().trim().min(1).max(40).default('Bookmarks'),
})

export class BookmarkService {
  private lastGood: BookmarksEnvelope | null = null
  private lastModifiedMs = -1

  constructor(private readonly config: AppConfig) {}

  async load(): Promise<BookmarksEnvelope> {
    try {
      const fileStat = await stat(this.config.bookmarksPath)
      if (this.lastGood && fileStat.mtimeMs === this.lastModifiedMs) return this.lastGood

      const raw: unknown = JSON.parse(await readFile(this.config.bookmarksPath, 'utf8'))
      if (!Array.isArray(raw)) throw new Error('not-array')

      let invalidEntryCount = 0
      const bookmarks = raw.flatMap((candidate, order) => {
        const parsed = entrySchema.safeParse(candidate)
        if (!parsed.success) {
          invalidEntryCount += 1
          return []
        }
        return [
          {
            ...parsed.data,
            id: createHash('sha256')
              .update(`${parsed.data.name}\0${parsed.data.url}\0${order}`)
              .digest('hex')
              .slice(0, 16),
            order,
          },
        ]
      })
      const issues = invalidEntryCount
        ? [
            {
              code: 'invalid-configuration' as const,
              message: `${invalidEntryCount} invalid bookmark ${invalidEntryCount === 1 ? 'entry was' : 'entries were'} omitted.`,
              retryable: false,
            },
          ]
        : []
      const generatedAt = new Date().toISOString()
      const envelope: BookmarksEnvelope = {
        schemaVersion: 1,
        data: { bookmarks, invalidEntryCount },
        meta: {
          generatedAt,
          sourceUpdatedAt: fileStat.mtime.toISOString(),
          freshness: 'fresh',
          staleAfterMs: 86_400_000,
          issues,
        },
      }
      this.lastGood = envelope
      this.lastModifiedMs = fileStat.mtimeMs
      return envelope
    } catch {
      if (this.lastGood) {
        return {
          ...this.lastGood,
          meta: {
            ...this.lastGood.meta,
            freshness: 'stale',
            issues: [
              {
                code: 'invalid-configuration',
                message:
                  'Showing the last valid bookmarks because the configuration could not be read.',
                retryable: true,
              },
            ],
          },
        }
      }
      throw new SourceError(
        'invalid-configuration',
        'Bookmarks are not configured. Copy config/bookmarks.example.json to config/bookmarks.json.',
        false,
        503,
      )
    }
  }
}
