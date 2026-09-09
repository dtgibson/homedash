import { describe, expect, it } from 'vitest'
import {
  BOOKMARK_SECTION_LIMIT,
  BOOKMARK_TOTAL_LIMIT,
  BOOKMARKS_PER_SECTION_LIMIT,
  canonicalBookmarkDocument,
  validateBookmarkDocument,
} from './bookmarkDocument'

function documentWith(
  sections: Array<{
    name: string
    bookmarks: Array<{ name: string; url: string }>
  }>,
) {
  return { schemaVersion: 1, sections }
}

function pathsFor(input: unknown, code: string) {
  const result = validateBookmarkDocument(input)
  expect(result.success).toBe(false)
  return result.success
    ? []
    : result.fieldErrors.filter((error) => error.code === code).map((error) => error.path)
}

describe('bookmark document validation and canonicalization', () => {
  it('trims boundary whitespace while retaining ordered content and submitted URL spelling', () => {
    const result = validateBookmarkDocument(
      documentWith([
        {
          name: '  Daily Notes  ',
          bookmarks: [
            {
              name: '  Bird  Log  ',
              url: '  HTTPS://Example.COM/path?q=Birds#Today  ',
            },
          ],
        },
        { name: 'Empty section', bookmarks: [] },
      ]),
    )

    expect(result).toEqual({
      success: true,
      fieldErrors: [],
      document: documentWith([
        {
          name: 'Daily Notes',
          bookmarks: [{ name: 'Bird  Log', url: 'HTTPS://Example.COM/path?q=Birds#Today' }],
        },
        { name: 'Empty section', bookmarks: [] },
      ]),
    })
    if (result.success) {
      expect(canonicalBookmarkDocument(result.document)).toBe(
        '{"schemaVersion":1,"sections":[{"name":"Daily Notes","bookmarks":[{"name":"Bird  Log","url":"HTTPS://Example.COM/path?q=Birds#Today"}]},{"name":"Empty section","bookmarks":[]}]}',
      )
    }
  })

  it('accepts zero sections and counts Unicode code points rather than UTF-16 units', () => {
    expect(validateBookmarkDocument(documentWith([]))).toMatchObject({ success: true })
    expect(
      validateBookmarkDocument(documentWith([{ name: '🪶'.repeat(40), bookmarks: [] }])),
    ).toMatchObject({ success: true })
    expect(pathsFor(documentWith([{ name: '🪶'.repeat(41), bookmarks: [] }]), 'too-long')).toEqual([
      '/document/sections/0/name',
    ])
  })

  it('rejects missing values, empty addresses, controls, and line separators', () => {
    const value = {
      schemaVersion: 1,
      sections: [
        {
          name: 'Bad\nsection',
          bookmarks: [
            { name: 'Bad\u0000bookmark', url: '  ' },
            { name: 'Bad\u2028bookmark', url: 'https://example.com' },
          ],
        },
      ],
    }
    expect(pathsFor(value, 'control-character')).toEqual([
      '/document/sections/0/name',
      '/document/sections/0/bookmarks/0/name',
      '/document/sections/0/bookmarks/1/name',
    ])
    expect(pathsFor(value, 'required')).toContain('/document/sections/0/bookmarks/0/url')
  })

  it('marks every section participating in an NFKC and case-insensitive duplicate', () => {
    const value = documentWith([
      { name: 'ＤＡＩＬＹ', bookmarks: [] },
      { name: 'daily', bookmarks: [] },
      { name: 'Travel', bookmarks: [] },
    ])
    expect(pathsFor(value, 'duplicate')).toEqual([
      '/document/sections/0/name',
      '/document/sections/1/name',
    ])
  })

  it('rejects unsupported versions, unknown properties, sparse values, and wrong leaves', () => {
    const sparseSections = Array(1) as unknown as Array<{
      name: string
      bookmarks: Array<{ name: string; url: string }>
    }>
    expect(pathsFor({ schemaVersion: 2, sections: [] }, 'unsupported-version')).toEqual([
      '/document/schemaVersion',
    ])
    expect(
      pathsFor(
        {
          schemaVersion: 1,
          'private-root-key': true,
          sections: [
            {
              name: 'Daily',
              'private-section-key': true,
              bookmarks: [
                {
                  name: 'Mail',
                  url: 'https://example.com',
                  'private-bookmark-key': true,
                },
              ],
            },
          ],
        },
        'unknown-property',
      ),
    ).toEqual(['/document', '/document/sections/0', '/document/sections/0/bookmarks/0'])
    expect(pathsFor(documentWith(sparseSections), 'required')).toEqual(['/document/sections/0'])
    expect(
      pathsFor(
        { schemaVersion: 1, sections: [{ name: 1, bookmarks: [{ name: [], url: 9 }] }] },
        'required',
      ),
    ).toEqual([
      '/document/sections/0/name',
      '/document/sections/0/bookmarks/0/name',
      '/document/sections/0/bookmarks/0/url',
    ])
  })

  it.each([
    'javascript:alert(1)',
    'data:text/plain,hello',
    'file:///tmp/private',
    '/relative',
    '//example.com/path',
    'https://user@example.com/private',
    'https://:secret@example.com/private',
    'https://',
  ])('rejects a non-HTTP(S), relative, credential-bearing, or malformed URL: %s', (url) => {
    expect(
      pathsFor(
        documentWith([{ name: 'Daily', bookmarks: [{ name: 'Candidate', url }] }]),
        'invalid-url',
      ),
    ).toEqual(['/document/sections/0/bookmarks/0/url'])
  })

  it('enforces section, per-section, and total bookmark limits independently', () => {
    const tooManySections = Array.from({ length: BOOKMARK_SECTION_LIMIT + 1 }, (_, index) => ({
      name: `Section ${index}`,
      bookmarks: [],
    }))
    expect(pathsFor(documentWith(tooManySections), 'too-many')).toContain('/document/sections')

    const tooManyInSection = Array.from(
      { length: BOOKMARKS_PER_SECTION_LIMIT + 1 },
      (_, index) => ({ name: `Bookmark ${index}`, url: `https://example.com/${index}` }),
    )
    expect(
      pathsFor(documentWith([{ name: 'Daily', bookmarks: tooManyInSection }]), 'too-many'),
    ).toContain('/document/sections/0/bookmarks')

    const totalSections = Array.from({ length: 3 }, (_, sectionIndex) => ({
      name: `Section ${sectionIndex}`,
      bookmarks: Array.from(
        { length: sectionIndex < 2 ? 50 : BOOKMARK_TOTAL_LIMIT - 99 },
        (_, index) => ({
          name: `Bookmark ${sectionIndex}-${index}`,
          url: `https://example.com/${sectionIndex}/${index}`,
        }),
      ),
    }))
    expect(pathsFor(documentWith(totalSections), 'too-many')).toContain('/document/sections')
  })
})
