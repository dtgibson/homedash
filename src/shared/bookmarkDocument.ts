import { z } from 'zod'

export const BOOKMARK_DOCUMENT_MAX_BYTES = 65_536
export const BOOKMARK_SECTION_LIMIT = 20
export const BOOKMARKS_PER_SECTION_LIMIT = 50
export const BOOKMARK_TOTAL_LIMIT = 100
export const BOOKMARK_URL_LIMIT = 2_048
export const BOOKMARK_DOCUMENT_FIELD_ERROR_LIMIT = 128
export const BOOKMARK_DOCUMENT_FIELD_PATH_LIMIT = 160

export type BookmarkDocumentV1 = {
  schemaVersion: 1
  sections: Array<{
    name: string
    bookmarks: Array<{ name: string; url: string }>
  }>
}

export type BookmarkDocumentFieldErrorCode =
  | 'required'
  | 'too-long'
  | 'control-character'
  | 'duplicate'
  | 'invalid-url'
  | 'too-many'
  | 'unknown-property'
  | 'unsupported-version'

export interface BookmarkDocumentFieldError {
  path: string
  code: BookmarkDocumentFieldErrorCode
  message: string
}

export type BookmarkDocumentValidation =
  | { success: true; document: BookmarkDocumentV1; fieldErrors: [] }
  | { success: false; document: null; fieldErrors: BookmarkDocumentFieldError[] }

const CONTROL_CHARACTER = /\p{Cc}|\u2028|\u2029/u

function codePoints(value: string) {
  return [...value].length
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validBookmarkUrl(value: string) {
  try {
    const url = new URL(value)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      Boolean(url.hostname) &&
      url.username === '' &&
      url.password === ''
    )
  } catch {
    return false
  }
}

function unknownProperties(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  fieldErrors: BookmarkDocumentFieldError[],
) {
  const names = new Set(allowed)
  if (Object.keys(value).some((key) => !names.has(key))) {
    fieldErrors.push({
      path,
      code: 'unknown-property',
      message: 'Remove unsupported properties from this item.',
    })
  }
}

function normalizedName(
  value: unknown,
  path: string,
  maximum: number,
  label: 'section' | 'bookmark',
  fieldErrors: BookmarkDocumentFieldError[],
) {
  if (typeof value !== 'string') {
    fieldErrors.push({ path, code: 'required', message: `Enter a name for this ${label}.` })
    return null
  }
  const normalized = value.trim()
  if (!normalized) {
    fieldErrors.push({ path, code: 'required', message: `Enter a name for this ${label}.` })
  } else if (codePoints(normalized) > maximum) {
    fieldErrors.push({
      path,
      code: 'too-long',
      message: `Keep ${label} names to ${maximum} characters or fewer.`,
    })
  }
  if (CONTROL_CHARACTER.test(normalized)) {
    fieldErrors.push({
      path,
      code: 'control-character',
      message: `${label === 'section' ? 'Section' : 'Bookmark'} names cannot contain control characters or line breaks.`,
    })
  }
  return normalized
}

export function validateBookmarkDocument(input: unknown): BookmarkDocumentValidation {
  const fieldErrors: BookmarkDocumentFieldError[] = []
  if (!isRecord(input)) {
    return {
      success: false,
      document: null,
      fieldErrors: [
        {
          path: '/document',
          code: 'required',
          message: 'Provide a complete bookmark document.',
        },
      ],
    }
  }

  unknownProperties(input, ['schemaVersion', 'sections'], '/document', fieldErrors)
  if (!Object.hasOwn(input, 'schemaVersion')) {
    fieldErrors.push({
      path: '/document/schemaVersion',
      code: 'required',
      message: 'Provide the bookmark document version.',
    })
  } else if (input.schemaVersion !== 1) {
    fieldErrors.push({
      path: '/document/schemaVersion',
      code: 'unsupported-version',
      message: 'This bookmark document version is not supported.',
    })
  }

  if (!Array.isArray(input.sections)) {
    fieldErrors.push({
      path: '/document/sections',
      code: 'required',
      message: 'Provide the ordered bookmark sections.',
    })
    return { success: false, document: null, fieldErrors }
  }
  if (input.sections.length > BOOKMARK_SECTION_LIMIT) {
    fieldErrors.push({
      path: '/document/sections',
      code: 'too-many',
      message: `A bookmark list can contain up to ${BOOKMARK_SECTION_LIMIT} sections.`,
    })
  }

  const sections: BookmarkDocumentV1['sections'] = []
  const duplicatePaths = new Map<string, string[]>()
  let totalBookmarks = 0

  for (let sectionIndex = 0; sectionIndex < input.sections.length; sectionIndex += 1) {
    const sectionValue = input.sections[sectionIndex]
    const sectionPath = `/document/sections/${sectionIndex}`
    if (!isRecord(sectionValue)) {
      fieldErrors.push({
        path: sectionPath,
        code: 'required',
        message: 'Provide a complete bookmark section.',
      })
      continue
    }
    unknownProperties(sectionValue, ['name', 'bookmarks'], sectionPath, fieldErrors)
    const namePath = `${sectionPath}/name`
    const name = normalizedName(sectionValue.name, namePath, 40, 'section', fieldErrors)
    if (name) {
      const duplicateKey = name.normalize('NFKC').toLocaleLowerCase('en-US')
      const paths = duplicatePaths.get(duplicateKey) ?? []
      paths.push(namePath)
      duplicatePaths.set(duplicateKey, paths)
    }

    if (!Array.isArray(sectionValue.bookmarks)) {
      fieldErrors.push({
        path: `${sectionPath}/bookmarks`,
        code: 'required',
        message: 'Provide the ordered bookmarks for this section.',
      })
      continue
    }
    totalBookmarks += sectionValue.bookmarks.length
    if (sectionValue.bookmarks.length > BOOKMARKS_PER_SECTION_LIMIT) {
      fieldErrors.push({
        path: `${sectionPath}/bookmarks`,
        code: 'too-many',
        message: `A section can contain up to ${BOOKMARKS_PER_SECTION_LIMIT} bookmarks.`,
      })
    }

    const bookmarks: Array<{ name: string; url: string }> = []
    for (let bookmarkIndex = 0; bookmarkIndex < sectionValue.bookmarks.length; bookmarkIndex += 1) {
      const bookmarkValue = sectionValue.bookmarks[bookmarkIndex]
      const bookmarkPath = `${sectionPath}/bookmarks/${bookmarkIndex}`
      if (!isRecord(bookmarkValue)) {
        fieldErrors.push({
          path: bookmarkPath,
          code: 'required',
          message: 'Provide a complete bookmark.',
        })
        continue
      }
      unknownProperties(bookmarkValue, ['name', 'url'], bookmarkPath, fieldErrors)
      const bookmarkName = normalizedName(
        bookmarkValue.name,
        `${bookmarkPath}/name`,
        100,
        'bookmark',
        fieldErrors,
      )
      let url: string | null = null
      if (typeof bookmarkValue.url !== 'string') {
        fieldErrors.push({
          path: `${bookmarkPath}/url`,
          code: 'required',
          message: 'Enter an address for this bookmark.',
        })
      } else {
        url = bookmarkValue.url.trim()
        if (!url) {
          fieldErrors.push({
            path: `${bookmarkPath}/url`,
            code: 'required',
            message: 'Enter an address for this bookmark.',
          })
        } else if (codePoints(url) > BOOKMARK_URL_LIMIT) {
          fieldErrors.push({
            path: `${bookmarkPath}/url`,
            code: 'too-long',
            message: `Keep the address to ${BOOKMARK_URL_LIMIT.toLocaleString('en-US')} characters or fewer.`,
          })
        } else if (!validBookmarkUrl(url)) {
          fieldErrors.push({
            path: `${bookmarkPath}/url`,
            code: 'invalid-url',
            message: 'Enter a complete http:// or https:// address without a password.',
          })
        }
      }
      if (bookmarkName !== null && url !== null) bookmarks.push({ name: bookmarkName, url })
    }
    if (name !== null) sections.push({ name, bookmarks })
  }

  if (totalBookmarks > BOOKMARK_TOTAL_LIMIT) {
    fieldErrors.push({
      path: '/document/sections',
      code: 'too-many',
      message: `A bookmark list can contain up to ${BOOKMARK_TOTAL_LIMIT} bookmarks.`,
    })
  }
  for (const paths of duplicatePaths.values()) {
    if (paths.length < 2) continue
    for (const path of paths) {
      fieldErrors.push({
        path,
        code: 'duplicate',
        message: 'Use a different name; section names must be unique.',
      })
    }
  }

  if (fieldErrors.length) return { success: false, document: null, fieldErrors }
  return { success: true, document: { schemaVersion: 1, sections }, fieldErrors: [] }
}

export function canonicalBookmarkDocument(document: BookmarkDocumentV1) {
  return JSON.stringify({
    schemaVersion: 1,
    sections: document.sections.map((section) => ({
      name: section.name.trim(),
      bookmarks: section.bookmarks.map((bookmark) => ({
        name: bookmark.name.trim(),
        url: bookmark.url.trim(),
      })),
    })),
  })
}

export const bookmarkDocumentSchema = z
  .custom<BookmarkDocumentV1>((input) => validateBookmarkDocument(input).success)
  .transform((input) => validateBookmarkDocument(input).document!)

export const bookmarkRevisionSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/)
