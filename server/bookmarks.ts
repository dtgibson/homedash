import { createHash, randomUUID } from 'node:crypto'
import { constants, type Stats } from 'node:fs'
import {
  lstat as nodeLstat,
  open as nodeOpen,
  rename as nodeRename,
  unlink as nodeUnlink,
  type FileHandle,
} from 'node:fs/promises'
import path from 'node:path'
import {
  BOOKMARK_DOCUMENT_MAX_BYTES,
  BOOKMARK_SECTION_LIMIT,
  BOOKMARK_TOTAL_LIMIT,
  BOOKMARKS_PER_SECTION_LIMIT,
  canonicalBookmarkDocument,
  validateBookmarkDocument,
  type BookmarkDocumentFieldError,
  type BookmarkDocumentV1,
} from '../src/shared/bookmarkDocument.js'
import {
  bookmarkUrlSchema,
  type Bookmark,
  type BookmarkDocumentResponse,
  type BookmarksEnvelope,
} from '../src/shared/contracts.js'
import type { AppConfig } from './config.js'
import { SourceError } from './errors.js'

export type BookmarkDocumentErrorCode =
  | 'bookmark-document-invalid'
  | 'bookmark-revision-conflict'
  | 'bookmark-source-invalid'
  | 'bookmark-source-unavailable'
  | 'bookmark-write-failed'

export class BookmarkDocumentServiceError extends Error {
  constructor(
    readonly code: BookmarkDocumentErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly statusCode: number,
    readonly fieldErrors?: BookmarkDocumentFieldError[],
  ) {
    super(message)
  }
}

export interface BookmarkFileSystem {
  lstat(filePath: string): ReturnType<typeof nodeLstat>
  open(filePath: string, flags: number, mode?: number): Promise<FileHandle>
  rename(from: string, to: string): Promise<void>
  unlink(filePath: string): Promise<void>
}

const defaultFileSystem: BookmarkFileSystem = {
  lstat: nodeLstat,
  open: nodeOpen,
  rename: nodeRename,
  unlink: nodeUnlink,
}

interface EditableDocument {
  document: BookmarkDocumentV1
  canonical: string
  revision: string
}

interface SourceObservation {
  display: BookmarksEnvelope
  editable: EditableDocument | null
}

interface LegacyEntry {
  name: string
  url: string
  group: string
  sourceIndex: number
}

class FifoMutex {
  private tail: Promise<void> = Promise.resolve()

  async run<T>(operation: () => Promise<T>): Promise<T> {
    let release!: () => void
    const predecessor = this.tail
    this.tail = new Promise<void>((resolve) => {
      release = resolve
    })
    await predecessor
    try {
      return await operation()
    } finally {
      release()
    }
  }
}

function revisionFor(canonical: string) {
  return `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`
}

function editableDocument(document: BookmarkDocumentV1): EditableDocument {
  const canonical = canonicalBookmarkDocument(document)
  return { document, canonical, revision: revisionFor(canonical) }
}

function bookmarkId(name: string, url: string, order: number) {
  return createHash('sha256').update(`${name}\0${url}\0${order}`).digest('hex').slice(0, 16)
}

function projectDocument(document: BookmarkDocumentV1): Bookmark[] {
  let order = 0
  return document.sections.flatMap((section) =>
    section.bookmarks.map((bookmark) => {
      const projected = {
        id: bookmarkId(bookmark.name, bookmark.url, order),
        group: section.name,
        name: bookmark.name,
        url: bookmark.url,
        order,
      }
      order += 1
      return projected
    }),
  )
}

function sourceInvalid(message = 'The bookmark file is not valid for editing.') {
  return new BookmarkDocumentServiceError('bookmark-source-invalid', message, false, 409)
}

function sourceUnavailable() {
  return new BookmarkDocumentServiceError(
    'bookmark-source-unavailable',
    'The bookmark file could not be read. Check the host configuration and try again.',
    true,
    503,
  )
}

function writeFailed() {
  return new BookmarkDocumentServiceError(
    'bookmark-write-failed',
    'Bookmarks could not be saved. Check the host storage and try again.',
    true,
    503,
  )
}

function isSafeLegacyName(value: unknown, maximum: number) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized || [...normalized].length > maximum || /\p{Cc}|\u2028|\u2029/u.test(normalized)) {
    return null
  }
  return normalized
}

function safeLegacyUrl(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if ([...normalized].length > 2_048 || !bookmarkUrlSchema.safeParse(normalized).success)
    return null
  try {
    if (!new URL(normalized).hostname) return null
  } catch {
    return null
  }
  return normalized
}

function parseLegacyEntry(value: unknown, sourceIndex: number): LegacyEntry | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  const name = isSafeLegacyName(candidate.name, 100)
  const url = safeLegacyUrl(candidate.url)
  const group = isSafeLegacyName(candidate.group ?? 'Bookmarks', 40)
  return name && url && group ? { name, url, group, sourceIndex } : null
}

function legacyDocument(entries: LegacyEntry[]): BookmarkDocumentV1 | null {
  const byName = new Map<
    string,
    { name: string; bookmarks: Array<{ name: string; url: string }> }
  >()
  for (const entry of entries) {
    const existing = byName.get(entry.group)
    const section = existing ?? { name: entry.group, bookmarks: [] }
    section.bookmarks.push({ name: entry.name, url: entry.url })
    byName.set(entry.group, section)
  }
  if (byName.size > BOOKMARK_SECTION_LIMIT) return null
  if (
    [...byName.values()].some((section) => section.bookmarks.length > BOOKMARKS_PER_SECTION_LIMIT)
  ) {
    return null
  }
  return { schemaVersion: 1, sections: [...byName.values()] }
}

function displayEnvelope(
  sections: string[],
  bookmarks: Bookmark[],
  invalidEntryCount: number,
  sourceUpdatedAt: string,
): BookmarksEnvelope {
  return {
    schemaVersion: 1,
    data: { sections, bookmarks, invalidEntryCount },
    meta: {
      generatedAt: new Date().toISOString(),
      sourceUpdatedAt,
      freshness: 'fresh',
      staleAfterMs: 86_400_000,
      issues: invalidEntryCount
        ? [
            {
              code: 'invalid-configuration',
              message: `${invalidEntryCount} invalid bookmark ${invalidEntryCount === 1 ? 'entry was' : 'entries were'} omitted.`,
              retryable: false,
            },
          ]
        : [],
    },
  }
}

function serviceError(error: unknown): BookmarkDocumentServiceError {
  return error instanceof BookmarkDocumentServiceError ? error : sourceUnavailable()
}

function errorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : ''
}

function sameFileIdentity(
  left: Pick<Stats, 'dev' | 'ino'>,
  right: { dev: number | bigint; ino: number | bigint },
) {
  return String(left.dev) === String(right.dev) && String(left.ino) === String(right.ino)
}

function sameFileObservation(left: Stats, right: Stats) {
  return (
    sameFileIdentity(left, right) &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  )
}

export interface BookmarkServiceOptions {
  fileSystem?: BookmarkFileSystem
  invalidateBookmarkId?: (bookmarkId: string) => void
}

export class BookmarkService {
  private lastGoodDisplay: BookmarksEnvelope | null = null
  private currentEditable: EditableDocument | null = null
  private readonly mutex = new FifoMutex()
  private readonly fileSystem: BookmarkFileSystem
  private readonly invalidateBookmarkId: (bookmarkId: string) => void

  constructor(
    private readonly config: AppConfig,
    options: BookmarkServiceOptions = {},
  ) {
    this.fileSystem = options.fileSystem ?? defaultFileSystem
    this.invalidateBookmarkId = options.invalidateBookmarkId ?? (() => undefined)
  }

  async load(): Promise<BookmarksEnvelope> {
    return this.mutex.run(async () => {
      try {
        const observation = await this.readObservation()
        this.publish(observation)
        return observation.display
      } catch {
        this.currentEditable = null
        if (this.lastGoodDisplay) {
          return {
            ...this.lastGoodDisplay,
            meta: {
              ...this.lastGoodDisplay.meta,
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
    })
  }

  async getDocument(): Promise<BookmarkDocumentResponse> {
    return this.mutex.run(async () => {
      let observation: SourceObservation
      try {
        observation = await this.readObservation()
      } catch (error) {
        this.currentEditable = null
        throw serviceError(error)
      }
      this.publish(observation)
      if (!observation.editable) throw sourceInvalid()
      return this.response(observation.editable, observation.display)
    })
  }

  async saveDocument(
    baseRevision: string,
    candidateValue: unknown,
  ): Promise<BookmarkDocumentResponse> {
    const candidateResult = validateBookmarkDocument(candidateValue)
    if (!candidateResult.success) {
      throw new BookmarkDocumentServiceError(
        'bookmark-document-invalid',
        'Fix the marked bookmark fields and try again.',
        false,
        422,
        candidateResult.fieldErrors,
      )
    }
    const candidate = editableDocument(candidateResult.document)

    return this.mutex.run(async () => {
      let initial: SourceObservation
      try {
        initial = await this.readObservation()
      } catch (error) {
        this.currentEditable = null
        throw serviceError(error)
      }
      if (!initial.editable) throw sourceInvalid()
      if (candidate.revision === initial.editable.revision) {
        this.publish(initial)
        return this.response(initial.editable, initial.display)
      }
      if (baseRevision !== initial.editable.revision) {
        throw new BookmarkDocumentServiceError(
          'bookmark-revision-conflict',
          'Saved bookmarks changed elsewhere. Reload them before saving this draft.',
          false,
          409,
        )
      }

      const targetPath = this.config.bookmarksPath
      const directoryPath = path.dirname(targetPath)
      const temporaryPath = path.join(
        directoryPath,
        `.${path.basename(targetPath)}.homedash-${process.pid}-${randomUUID()}.tmp`,
      )
      const diskBytes = Buffer.from(`${candidate.canonical}\n`, 'utf8')
      let temporaryHandle: FileHandle | null = null
      let renamed = false
      try {
        const flags =
          constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          (typeof constants.O_NOFOLLOW === 'number' ? constants.O_NOFOLLOW : 0)
        temporaryHandle = await this.fileSystem.open(temporaryPath, flags, 0o600)
        await temporaryHandle.writeFile(diskBytes)
        await temporaryHandle.sync()
        await temporaryHandle.close()
        temporaryHandle = null

        let immediatelyCurrent: SourceObservation
        try {
          immediatelyCurrent = await this.readObservation()
        } catch (error) {
          this.currentEditable = null
          throw serviceError(error)
        }
        if (!immediatelyCurrent.editable) throw sourceInvalid()
        if (immediatelyCurrent.editable.revision !== initial.editable.revision) {
          throw new BookmarkDocumentServiceError(
            'bookmark-revision-conflict',
            'Saved bookmarks changed elsewhere. Reload them before saving this draft.',
            false,
            409,
          )
        }

        await this.fileSystem.rename(temporaryPath, targetPath)
        renamed = true
        await this.syncDirectory(directoryPath)

        let verified: SourceObservation
        try {
          verified = await this.readObservation()
        } catch {
          throw writeFailed()
        }
        if (
          !verified.editable ||
          verified.editable.revision !== candidate.revision ||
          verified.editable.canonical !== candidate.canonical
        ) {
          throw writeFailed()
        }
        this.publish(verified)
        return this.response(verified.editable, verified.display)
      } catch (error) {
        if (error instanceof BookmarkDocumentServiceError) throw error
        throw writeFailed()
      } finally {
        await temporaryHandle?.close().catch(() => undefined)
        if (!renamed) await this.fileSystem.unlink(temporaryPath).catch(() => undefined)
      }
    })
  }

  async findCurrentById(id: string): Promise<Bookmark | null> {
    const display = await this.load()
    return display.data.bookmarks.find((bookmark) => bookmark.id === id) ?? null
  }

  private async readObservation(): Promise<SourceObservation> {
    let handle: FileHandle | null = null
    let bytes: Buffer
    let fileStat: Stats
    try {
      const noFollow = typeof constants.O_NOFOLLOW === 'number' ? constants.O_NOFOLLOW : 0
      handle = await this.fileSystem.open(this.config.bookmarksPath, constants.O_RDONLY | noFollow)
      const beforeRead = await handle.stat({ bigint: false })
      if (!beforeRead.isFile() || beforeRead.size > BOOKMARK_DOCUMENT_MAX_BYTES) {
        throw sourceInvalid()
      }

      const bounded = Buffer.allocUnsafe(BOOKMARK_DOCUMENT_MAX_BYTES + 1)
      let offset = 0
      while (offset < bounded.byteLength) {
        const { bytesRead } = await handle.read(
          bounded,
          offset,
          bounded.byteLength - offset,
          offset,
        )
        if (bytesRead === 0) break
        offset += bytesRead
      }

      const afterRead = await handle.stat({ bigint: false })
      const pathStat = await this.fileSystem.lstat(this.config.bookmarksPath)
      if (
        !afterRead.isFile() ||
        !pathStat.isFile() ||
        pathStat.isSymbolicLink() ||
        !sameFileObservation(beforeRead, afterRead) ||
        !sameFileIdentity(afterRead, pathStat) ||
        afterRead.size > BOOKMARK_DOCUMENT_MAX_BYTES ||
        offset > BOOKMARK_DOCUMENT_MAX_BYTES
      ) {
        throw sourceInvalid()
      }
      fileStat = afterRead
      bytes = bounded.subarray(0, offset)
    } catch (error) {
      if (error instanceof BookmarkDocumentServiceError) throw error
      if (['ELOOP', 'EMLINK'].includes(errorCode(error))) throw sourceInvalid()
      throw sourceUnavailable()
    } finally {
      await handle?.close().catch(() => undefined)
    }

    let parsed: unknown
    try {
      const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      parsed = JSON.parse(source)
    } catch {
      throw sourceInvalid()
    }
    const sourceUpdatedAt = fileStat.mtime.toISOString()

    if (Array.isArray(parsed)) return this.readLegacy(parsed, sourceUpdatedAt)
    const result = validateBookmarkDocument(parsed)
    if (!result.success) throw sourceInvalid()
    const editable = editableDocument(result.document)
    return {
      editable,
      display: displayEnvelope(
        editable.document.sections.map((section) => section.name),
        projectDocument(editable.document),
        0,
        sourceUpdatedAt,
      ),
    }
  }

  private readLegacy(parsed: unknown[], sourceUpdatedAt: string): SourceObservation {
    if (parsed.length > BOOKMARK_TOTAL_LIMIT) throw sourceInvalid()
    let invalidEntryCount = 0
    const entries = parsed.flatMap((value, sourceIndex) => {
      const entry = parseLegacyEntry(value, sourceIndex)
      if (!entry) {
        invalidEntryCount += 1
        return []
      }
      return [entry]
    })
    const document = legacyDocument(entries)
    if (!document) throw sourceInvalid()
    const bookmarks = entries.map((entry) => ({
      id: bookmarkId(entry.name, entry.url, entry.sourceIndex),
      group: entry.group,
      name: entry.name,
      url: entry.url,
      order: entry.sourceIndex,
    }))
    return {
      display: displayEnvelope(
        document.sections.map((section) => section.name),
        bookmarks,
        invalidEntryCount,
        sourceUpdatedAt,
      ),
      editable:
        invalidEntryCount === 0 && validateBookmarkDocument(document).success
          ? editableDocument(document)
          : null,
    }
  }

  private publish(observation: SourceObservation) {
    const previous = this.lastGoodDisplay?.data.bookmarks ?? []
    const next = observation.display.data.bookmarks
    const nextRegistry = new Map(next.map((bookmark) => [bookmark.id, bookmark.url]))
    for (const bookmark of previous) {
      if (nextRegistry.get(bookmark.id) !== bookmark.url) this.invalidateBookmarkId(bookmark.id)
    }
    this.lastGoodDisplay = observation.display
    this.currentEditable = observation.editable
  }

  private response(
    editable: EditableDocument,
    display: BookmarksEnvelope,
  ): BookmarkDocumentResponse {
    return {
      schemaVersion: 1,
      revision: editable.revision,
      document: editable.document,
      display,
    }
  }

  private async syncDirectory(directoryPath: string) {
    let handle: FileHandle | null = null
    try {
      handle = await this.fileSystem.open(directoryPath, constants.O_RDONLY)
      await handle.sync()
    } catch (error) {
      if (!['EINVAL', 'ENOTSUP'].includes(errorCode(error))) throw error
    } finally {
      await handle?.close().catch(() => undefined)
    }
  }
}
