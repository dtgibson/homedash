import { describe, expect, it } from 'vitest'
import { bookmarkSchema, bookmarkUrlSchema, bookmarksEnvelopeSchema } from './contracts'

const meta = {
  generatedAt: '2026-09-09T12:00:00.000Z',
  sourceUpdatedAt: '2026-09-09T12:00:00.000Z',
  freshness: 'fresh',
  staleAfterMs: 60_000,
  issues: [],
}

function bookmark(url: string) {
  return { id: 'bookmark', group: 'Daily', name: 'Bookmark', url, order: 0 }
}

describe('shared bookmark URL policy', () => {
  it.each([
    'http://example.com',
    'https://example.com/path?query=birds%20today#recent-sightings',
    'HTTPS://Example.com/case-insensitive-scheme',
  ])('accepts an HTTP(S) URL without credentials: %s', (url) => {
    expect(bookmarkUrlSchema.safeParse(url).success).toBe(true)
    expect(bookmarkSchema.safeParse(bookmark(url)).success).toBe(true)
    expect(
      bookmarksEnvelopeSchema.safeParse({
        schemaVersion: 1,
        data: { bookmarks: [bookmark(url)], invalidEntryCount: 0 },
        meta,
      }).success,
    ).toBe(true)
  })

  it.each([
    'javascript:alert(document.domain)',
    'JaVaScRiPt:alert(document.domain)',
    'javascript:https://example.com',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    '//example.com/protocol-relative',
    'not a URL',
    'https://',
    'httpsx://example.com',
    'HtTpSx://example.com',
    'https://user@example.com/private',
    'https://:password@example.com/private',
    'https://example.com@evil.invalid/private',
  ])('rejects a non-web, malformed, smuggled, or credential-bearing URL: %s', (url) => {
    expect(bookmarkUrlSchema.safeParse(url).success).toBe(false)
    expect(bookmarkSchema.safeParse(bookmark(url)).success).toBe(false)
    expect(
      bookmarksEnvelopeSchema.safeParse({
        schemaVersion: 1,
        data: { bookmarks: [bookmark(url)], invalidEntryCount: 0 },
        meta,
      }).success,
    ).toBe(false)
  })
})
