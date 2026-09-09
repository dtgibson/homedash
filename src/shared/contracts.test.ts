import { describe, expect, it } from 'vitest'
import {
  bookmarkSchema,
  bookmarkUrlSchema,
  bookmarksEnvelopeSchema,
  storedBookmarksEnvelopeSchema,
} from './contracts'

const meta = {
  generatedAt: '2026-09-09T12:00:00.000Z',
  sourceUpdatedAt: '2026-09-09T12:00:00.000Z',
  freshness: 'fresh',
  staleAfterMs: 60_000,
  issues: [],
}

function bookmark(url: string) {
  return { id: '0123456789abcdef', group: 'Daily', name: 'Bookmark', url, order: 0 }
}

function bookmarkAt(index: number, group = 'Daily', url = `https://example.com/${index}`) {
  return {
    id: index.toString(16).padStart(16, '0'),
    group,
    name: `Bookmark ${index}`,
    url,
    order: index,
  }
}

function envelope(bookmarks: ReturnType<typeof bookmarkAt>[], sections?: string[]) {
  return {
    schemaVersion: 1,
    data: {
      ...(sections ? { sections } : {}),
      bookmarks,
      invalidEntryCount: 0,
    },
    meta,
  }
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
        data: { sections: ['Daily'], bookmarks: [bookmark(url)], invalidEntryCount: 0 },
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
        data: { sections: ['Daily'], bookmarks: [bookmark(url)], invalidEntryCount: 0 },
        meta,
      }).success,
    ).toBe(false)
  })

  it('rejects duplicate section projections and bookmarks outside the section list', () => {
    expect(
      bookmarksEnvelopeSchema.safeParse({
        schemaVersion: 1,
        data: {
          sections: ['Daily', 'Daily'],
          bookmarks: [bookmark('https://example.com')],
          invalidEntryCount: 0,
        },
        meta,
      }).success,
    ).toBe(false)
    expect(
      bookmarksEnvelopeSchema.safeParse({
        schemaVersion: 1,
        data: {
          sections: ['Projects'],
          bookmarks: [bookmark('https://example.com')],
          invalidEntryCount: 0,
        },
        meta,
      }).success,
    ).toBe(false)
  })

  it('requires favicon-safe lowercase 16-hex bookmark IDs', () => {
    expect(bookmarkSchema.safeParse(bookmark('https://example.com')).success).toBe(true)
    expect(
      bookmarkSchema.safeParse({ ...bookmark('https://example.com'), id: '../private' }).success,
    ).toBe(false)
    expect(
      bookmarkSchema.safeParse({ ...bookmark('https://example.com'), id: 'ABCDEF0123456789' })
        .success,
    ).toBe(false)
  })

  it('enforces 20 sections and 100 total bookmarks for live and migrated snapshots', () => {
    const twentySections = Array.from({ length: 20 }, (_, index) => `Section ${index}`)
    const twentyOneSections = [...twentySections, 'Section 20']
    const hundred = Array.from({ length: 100 }, (_, index) =>
      bookmarkAt(index, `Section ${Math.floor(index / 5)}`),
    )
    const hundredOne = [...hundred, bookmarkAt(100, 'Section 0')]

    expect(bookmarksEnvelopeSchema.safeParse(envelope(hundred, twentySections)).success).toBe(true)
    expect(bookmarksEnvelopeSchema.safeParse(envelope(hundred, twentyOneSections)).success).toBe(
      false,
    )
    expect(bookmarksEnvelopeSchema.safeParse(envelope(hundredOne, twentySections)).success).toBe(
      false,
    )
    expect(
      storedBookmarksEnvelopeSchema.safeParse(envelope(hundred, twentyOneSections)).success,
    ).toBe(false)
    expect(storedBookmarksEnvelopeSchema.safeParse(envelope(hundred)).success).toBe(true)
    expect(
      storedBookmarksEnvelopeSchema.safeParse(
        envelope(Array.from({ length: 21 }, (_, index) => bookmarkAt(index, `Group ${index}`))),
      ).success,
    ).toBe(false)
    expect(storedBookmarksEnvelopeSchema.safeParse(envelope(hundredOne)).success).toBe(false)
  })

  it('enforces the 2,048-code-point URL limit for live and migrated snapshots', () => {
    const prefix = 'https://example.com/'
    const atLimit = `${prefix}${'a'.repeat(2_048 - [...prefix].length)}`
    const overLimit = `${atLimit}🪶`

    expect([...atLimit]).toHaveLength(2_048)
    expect(bookmarkUrlSchema.safeParse(atLimit).success).toBe(true)
    expect(bookmarkUrlSchema.safeParse(overLimit).success).toBe(false)
    expect(
      bookmarksEnvelopeSchema.safeParse(envelope([bookmarkAt(0, 'Daily', atLimit)], ['Daily']))
        .success,
    ).toBe(true)
    expect(
      bookmarksEnvelopeSchema.safeParse(envelope([bookmarkAt(0, 'Daily', overLimit)], ['Daily']))
        .success,
    ).toBe(false)
    expect(
      storedBookmarksEnvelopeSchema.safeParse(envelope([bookmarkAt(0, 'Daily', atLimit)])).success,
    ).toBe(true)
    expect(
      storedBookmarksEnvelopeSchema.safeParse(envelope([bookmarkAt(0, 'Daily', overLimit)]))
        .success,
    ).toBe(false)
  })
})
