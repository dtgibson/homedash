import { constants } from 'node:fs'
import {
  lstat,
  mkdtemp,
  open,
  readFile,
  readdir,
  rename,
  symlink,
  unlink,
  utimes,
  writeFile,
  type FileHandle,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { BOOKMARK_DOCUMENT_MAX_BYTES } from '../src/shared/bookmarkDocument'
import { BookmarkDocumentServiceError, BookmarkService, type BookmarkFileSystem } from './bookmarks'
import { loadConfig } from './config'

const oldDocument = {
  schemaVersion: 1 as const,
  sections: [
    {
      name: 'Daily',
      bookmarks: [
        { name: 'First', url: 'https://first.example/deep?private=1' },
        { name: 'Second', url: 'https://second.example/' },
      ],
    },
  ],
}

const newDocument = {
  schemaVersion: 1 as const,
  sections: [
    {
      name: 'Later',
      bookmarks: [{ name: 'Third', url: 'https://third.example/' }],
    },
  ],
}

function config(bookmarksPath: string) {
  return loadConfig({ BOOKMARKS_PATH: bookmarksPath })
}

async function replaceFile(bookmarksPath: string, value: unknown, modifiedAtMs = Date.now()) {
  await writeFile(bookmarksPath, typeof value === 'string' ? value : JSON.stringify(value), 'utf8')
  const modifiedAt = new Date(modifiedAtMs)
  await utimes(bookmarksPath, modifiedAt, modifiedAt)
}

async function fixture(value: unknown = oldDocument) {
  const directory = await mkdtemp(path.join(tmpdir(), 'homedash-bookmarks-'))
  const bookmarksPath = path.join(directory, 'bookmarks.json')
  await replaceFile(bookmarksPath, value)
  return { directory, bookmarksPath }
}

function expectServiceError(error: unknown, code: BookmarkDocumentServiceError['code']) {
  expect(error).toBeInstanceOf(BookmarkDocumentServiceError)
  expect((error as BookmarkDocumentServiceError).code).toBe(code)
}

const realFileSystem: BookmarkFileSystem = { lstat, open, rename, unlink }

function wrappedHandle(
  handle: FileHandle,
  overrides: Partial<Record<'read' | 'writeFile' | 'stat' | 'sync' | 'close', unknown>>,
) {
  return new Proxy(handle, {
    get(target, property) {
      const override = overrides[property as keyof typeof overrides]
      if (override) return override
      const value = Reflect.get(target, property, target) as unknown
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as FileHandle
}

describe('BookmarkService document compatibility', () => {
  it('projects V1 section and bookmark order, including named empty sections', async () => {
    const { bookmarksPath } = await fixture({
      schemaVersion: 1,
      sections: [
        { name: 'Empty first', bookmarks: [] },
        {
          name: 'Daily',
          bookmarks: [
            { name: 'Two', url: 'https://two.example/' },
            { name: 'One', url: 'https://one.example/' },
          ],
        },
      ],
    })
    const service = new BookmarkService(config(bookmarksPath))

    const display = await service.load()
    const editable = await service.getDocument()

    expect(display.data.sections).toEqual(['Empty first', 'Daily'])
    expect(
      display.data.bookmarks.map(({ group, name, order }) => ({ group, name, order })),
    ).toEqual([
      { group: 'Daily', name: 'Two', order: 0 },
      { group: 'Daily', name: 'One', order: 1 },
    ])
    expect(editable.document).toEqual({
      schemaVersion: 1,
      sections: [
        { name: 'Empty first', bookmarks: [] },
        {
          name: 'Daily',
          bookmarks: [
            { name: 'Two', url: 'https://two.example/' },
            { name: 'One', url: 'https://one.example/' },
          ],
        },
      ],
    })
    expect(editable.revision).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('converts a complete legacy array in first-seen group order without rewriting it', async () => {
    const legacy = [
      { group: 'Daily', name: 'First', url: 'https://first.example/' },
      { group: 'Projects', name: 'Code', url: 'https://code.example/' },
      { group: 'Daily', name: 'Second', url: 'https://second.example/' },
      { name: 'Loose', url: 'https://loose.example/' },
    ]
    const { bookmarksPath } = await fixture(legacy)
    const originalBytes = await readFile(bookmarksPath, 'utf8')
    const service = new BookmarkService(config(bookmarksPath))

    const display = await service.load()
    const response = await service.getDocument()

    expect(display.data.sections).toEqual(['Daily', 'Projects', 'Bookmarks'])
    expect(display.data.bookmarks.map((bookmark) => bookmark.order)).toEqual([0, 1, 2, 3])
    expect(response.document.sections).toEqual([
      {
        name: 'Daily',
        bookmarks: [
          { name: 'First', url: 'https://first.example/' },
          { name: 'Second', url: 'https://second.example/' },
        ],
      },
      {
        name: 'Projects',
        bookmarks: [{ name: 'Code', url: 'https://code.example/' }],
      },
      {
        name: 'Bookmarks',
        bookmarks: [{ name: 'Loose', url: 'https://loose.example/' }],
      },
    ])
    expect(await readFile(bookmarksPath, 'utf8')).toBe(originalBytes)
  })

  it('keeps bounded partial legacy content displayable but never offers it for editing', async () => {
    const { bookmarksPath } = await fixture([
      { group: 'Daily', name: 'Good', url: 'https://good.example/' },
      { group: 'Daily', name: '', url: 'javascript:alert(1)' },
    ])
    const service = new BookmarkService(config(bookmarksPath))

    const display = await service.load()
    expect(display.data.bookmarks.map((bookmark) => bookmark.name)).toEqual(['Good'])
    expect(display.data.invalidEntryCount).toBe(1)
    await expect(service.getDocument()).rejects.toSatisfy((error: unknown) => {
      expectServiceError(error, 'bookmark-source-invalid')
      return true
    })
  })

  it('displays normalized-name ambiguity as legacy content but refuses a lossy editing base', async () => {
    const { bookmarksPath } = await fixture([
      { group: 'ＤＡＩＬＹ', name: 'Wide', url: 'https://wide.example/' },
      { group: 'daily', name: 'Lower', url: 'https://lower.example/' },
    ])
    const service = new BookmarkService(config(bookmarksPath))

    const display = await service.load()
    expect(display.data.sections).toEqual(['ＤＡＩＬＹ', 'daily'])
    expect(display.data.bookmarks).toHaveLength(2)
    await expect(service.getDocument()).rejects.toMatchObject({
      code: 'bookmark-source-invalid',
      statusCode: 409,
    })
  })

  it('returns its last display as stale after an invalid host replacement without exposing it as editable', async () => {
    const { bookmarksPath } = await fixture(oldDocument)
    const service = new BookmarkService(config(bookmarksPath))
    const initial = await service.load()

    await replaceFile(bookmarksPath, '{not json')
    const stale = await service.load()

    expect(stale.data).toEqual(initial.data)
    expect(stale.meta.freshness).toBe('stale')
    await expect(service.getDocument()).rejects.toMatchObject({ code: 'bookmark-source-invalid' })
  })
})

describe('BookmarkService descriptor-bound source reads', () => {
  it('opens the target read-only with no-follow and rejects a stable symlink', async () => {
    const { directory, bookmarksPath } = await fixture()
    const regularPath = path.join(directory, 'regular.json')
    await rename(bookmarksPath, regularPath)
    await symlink(regularPath, bookmarksPath)
    const seen: number[] = []
    const fileSystem: BookmarkFileSystem = {
      ...realFileSystem,
      async open(filePath, flags, mode) {
        if (filePath === bookmarksPath) seen.push(flags)
        return open(filePath, flags, mode)
      },
    }

    await expect(
      new BookmarkService(config(bookmarksPath), { fileSystem }).getDocument(),
    ).rejects.toMatchObject({ code: 'bookmark-source-invalid' })
    expect(seen[0]! & constants.O_RDONLY).toBe(constants.O_RDONLY)
    if (typeof constants.O_NOFOLLOW === 'number') {
      expect(seen[0]! & constants.O_NOFOLLOW).toBe(constants.O_NOFOLLOW)
    }
  })

  it('rejects a target swapped to a symlink after open without reading the replacement', async () => {
    const { directory, bookmarksPath } = await fixture()
    const openedPath = path.join(directory, 'opened.json')
    const replacementPath = path.join(directory, 'replacement.json')
    await writeFile(replacementPath, JSON.stringify(newDocument), 'utf8')
    let swapped = false
    const fileSystem: BookmarkFileSystem = {
      ...realFileSystem,
      async open(filePath, flags, mode) {
        const handle = await open(filePath, flags, mode)
        if (filePath === bookmarksPath && !swapped) {
          swapped = true
          await rename(bookmarksPath, openedPath)
          await symlink(replacementPath, bookmarksPath)
        }
        return handle
      },
    }

    await expect(
      new BookmarkService(config(bookmarksPath), { fileSystem }).getDocument(),
    ).rejects.toMatchObject({ code: 'bookmark-source-invalid' })
  })

  it('reads at most max plus one byte and rejects growth on the opened descriptor', async () => {
    const { bookmarksPath } = await fixture()
    let largestRead = 0
    let grown = false
    const fileSystem: BookmarkFileSystem = {
      ...realFileSystem,
      async open(filePath, flags, mode) {
        const handle = await open(filePath, flags, mode)
        if (filePath !== bookmarksPath) return handle
        return wrappedHandle(handle, {
          read: async (buffer: Buffer, offset: number, length: number, position: number) => {
            largestRead = Math.max(largestRead, length)
            if (!grown) {
              grown = true
              await writeFile(bookmarksPath, Buffer.alloc(BOOKMARK_DOCUMENT_MAX_BYTES + 2))
            }
            return handle.read(buffer, offset, length, position)
          },
        })
      },
    }

    await expect(
      new BookmarkService(config(bookmarksPath), { fileSystem }).getDocument(),
    ).rejects.toMatchObject({ code: 'bookmark-source-invalid' })
    expect(largestRead).toBe(BOOKMARK_DOCUMENT_MAX_BYTES + 1)
  })
})

describe('BookmarkService whole-document replacement', () => {
  it('trims and atomically persists the canonical V1 document with mode 0600', async () => {
    const { bookmarksPath } = await fixture(oldDocument)
    const service = new BookmarkService(config(bookmarksPath))
    const base = await service.getDocument()

    const saved = await service.saveDocument(base.revision, {
      schemaVersion: 1,
      sections: [
        {
          name: '  Later  ',
          bookmarks: [{ name: '  Third  ', url: '  HTTPS://third.example/path  ' }],
        },
      ],
    })

    expect(saved.document.sections[0]).toEqual({
      name: 'Later',
      bookmarks: [{ name: 'Third', url: 'HTTPS://third.example/path' }],
    })
    expect(await readFile(bookmarksPath, 'utf8')).toBe(
      '{"schemaVersion":1,"sections":[{"name":"Later","bookmarks":[{"name":"Third","url":"HTTPS://third.example/path"}]}]}\n',
    )
    expect((await lstat(bookmarksPath)).mode & 0o777).toBe(0o600)
  })

  it('rejects stale candidates, allows semantic reformatting, and treats current content as idempotent', async () => {
    const { bookmarksPath } = await fixture(oldDocument)
    const service = new BookmarkService(config(bookmarksPath))
    const base = await service.getDocument()

    await replaceFile(bookmarksPath, `\n${JSON.stringify(oldDocument, null, 2)}\n`)
    const saved = await service.saveDocument(base.revision, newDocument)
    expect(saved.document).toEqual(newDocument)

    const staleBase = base.revision
    await expect(service.saveDocument(staleBase, oldDocument)).rejects.toMatchObject({
      code: 'bookmark-revision-conflict',
      statusCode: 409,
    })
    await expect(service.saveDocument(staleBase, newDocument)).resolves.toMatchObject({
      revision: saved.revision,
      document: newDocument,
    })
  })

  it('orders simultaneous saves so only the first candidate using a revision succeeds', async () => {
    const { bookmarksPath } = await fixture(oldDocument)
    const service = new BookmarkService(config(bookmarksPath))
    const base = await service.getDocument()
    const anotherDocument = {
      schemaVersion: 1 as const,
      sections: [{ name: 'Another', bookmarks: [] }],
    }

    const first = service.saveDocument(base.revision, newDocument)
    const second = service.saveDocument(base.revision, anotherDocument)

    await expect(first).resolves.toMatchObject({ document: newDocument })
    await expect(second).rejects.toMatchObject({ code: 'bookmark-revision-conflict' })
    expect(JSON.parse(await readFile(bookmarksPath, 'utf8'))).toEqual(newDocument)
  })

  it('rejects an invalid candidate before any file operation or state publication', async () => {
    const { bookmarksPath } = await fixture(oldDocument)
    const fileSystem = { ...realFileSystem, open: vi.fn(realFileSystem.open) }
    const service = new BookmarkService(config(bookmarksPath), { fileSystem })
    const base = await service.getDocument()
    fileSystem.open.mockClear()

    await expect(
      service.saveDocument(base.revision, {
        schemaVersion: 1,
        sections: [{ name: 'Daily', bookmarks: [{ name: '', url: 'javascript:alert(1)' }] }],
      }),
    ).rejects.toMatchObject({ code: 'bookmark-document-invalid', statusCode: 422 })
    expect(fileSystem.open).not.toHaveBeenCalled()
    expect(JSON.parse(await readFile(bookmarksPath, 'utf8'))).toEqual(oldDocument)
  })

  it('invalidates every old favicon identity removed by a verified save', async () => {
    const { bookmarksPath } = await fixture(oldDocument)
    const invalidateBookmarkId = vi.fn()
    const service = new BookmarkService(config(bookmarksPath), { invalidateBookmarkId })
    const base = await service.getDocument()
    const oldIds = base.display.data.bookmarks.map((bookmark) => bookmark.id)

    await service.saveDocument(base.revision, newDocument)

    expect(invalidateBookmarkId.mock.calls.map(([id]) => id)).toEqual(oldIds)
  })
})

type FailureStage =
  'create' | 'write' | 'temp-sync' | 'precheck' | 'rename' | 'directory-sync' | 'post-read'

function faultingFileSystem(stage: FailureStage, directory: string, bookmarksPath: string) {
  let targetOpenCalls = 0
  let armed = false
  const injected = Object.assign(new Error(`injected ${stage}`), { code: 'EIO' })
  const fileSystem: BookmarkFileSystem = {
    ...realFileSystem,
    async open(filePath, flags, mode) {
      const isTemporary = filePath.includes('.homedash-')
      if (filePath === bookmarksPath) {
        targetOpenCalls += 1
        if (
          armed &&
          ((stage === 'precheck' && targetOpenCalls === 2) ||
            (stage === 'post-read' && targetOpenCalls === 3))
        ) {
          throw injected
        }
      }
      if (armed && stage === 'create' && isTemporary) throw injected
      const handle = await open(filePath, flags, mode)
      if (armed && isTemporary && stage === 'write') {
        return wrappedHandle(handle, { writeFile: async () => Promise.reject(injected) })
      }
      if (armed && isTemporary && stage === 'temp-sync') {
        return wrappedHandle(handle, { sync: async () => Promise.reject(injected) })
      }
      if (armed && filePath === directory && stage === 'directory-sync') {
        return wrappedHandle(handle, { sync: async () => Promise.reject(injected) })
      }
      return handle
    },
    async rename(from, to) {
      if (armed && stage === 'rename') throw injected
      return rename(from, to)
    },
  }
  return {
    fileSystem,
    arm() {
      targetOpenCalls = 0
      armed = true
    },
  }
}

describe('BookmarkService atomic failure behavior', () => {
  it.each([
    ['create', 'bookmark-write-failed', oldDocument],
    ['write', 'bookmark-write-failed', oldDocument],
    ['temp-sync', 'bookmark-write-failed', oldDocument],
    ['precheck', 'bookmark-source-unavailable', oldDocument],
    ['rename', 'bookmark-write-failed', oldDocument],
    ['directory-sync', 'bookmark-write-failed', newDocument],
    ['post-read', 'bookmark-write-failed', newDocument],
  ] as const)(
    'keeps the target complete and cleans temporary files after a %s failure',
    async (stage, expectedCode, expectedDocument) => {
      const { directory, bookmarksPath } = await fixture(oldDocument)
      const fault = faultingFileSystem(stage, directory, bookmarksPath)
      const service = new BookmarkService(config(bookmarksPath), {
        fileSystem: fault.fileSystem,
      })
      const base = await service.getDocument()
      fault.arm()

      await expect(service.saveDocument(base.revision, newDocument)).rejects.toMatchObject({
        code: expectedCode,
        statusCode: 503,
      })
      expect(JSON.parse(await readFile(bookmarksPath, 'utf8'))).toEqual(expectedDocument)
      expect((await readdir(directory)).filter((name) => name.includes('.homedash-'))).toEqual([])
    },
  )

  it('does not displace the accepted last-good display after a pre-rename save failure', async () => {
    const { directory, bookmarksPath } = await fixture(oldDocument)
    const fault = faultingFileSystem('rename', directory, bookmarksPath)
    const service = new BookmarkService(config(bookmarksPath), { fileSystem: fault.fileSystem })
    const initial = await service.load()
    const base = await service.getDocument()
    fault.arm()
    await expect(service.saveDocument(base.revision, newDocument)).rejects.toBeInstanceOf(
      BookmarkDocumentServiceError,
    )

    await replaceFile(bookmarksPath, '{broken')
    const stale = await service.load()
    expect(stale.data).toEqual(initial.data)
    expect(stale.meta.freshness).toBe('stale')
  })

  it('accepts unsupported directory fsync errors only after authoritative reread', async () => {
    const { directory, bookmarksPath } = await fixture(oldDocument)
    const fileSystem: BookmarkFileSystem = {
      ...realFileSystem,
      async open(filePath, flags, mode) {
        const handle = await open(filePath, flags, mode)
        if (filePath !== directory) return handle
        return wrappedHandle(handle, {
          sync: async () =>
            Promise.reject(Object.assign(new Error('unsupported'), { code: 'ENOTSUP' })),
        })
      },
    }
    const service = new BookmarkService(config(bookmarksPath), { fileSystem })
    const base = await service.getDocument()

    await expect(service.saveDocument(base.revision, newDocument)).resolves.toMatchObject({
      document: newDocument,
    })
    expect(JSON.parse(await readFile(bookmarksPath, 'utf8'))).toEqual(newDocument)
  })

  it('opens temporary files with exclusive 0600 no-follow flags', async () => {
    const { bookmarksPath } = await fixture(oldDocument)
    const seen: Array<{ filePath: string; flags: number; mode?: number }> = []
    const fileSystem: BookmarkFileSystem = {
      ...realFileSystem,
      async open(filePath, flags, mode) {
        seen.push({ filePath, flags, mode })
        return open(filePath, flags, mode)
      },
    }
    const service = new BookmarkService(config(bookmarksPath), { fileSystem })
    const base = await service.getDocument()
    await service.saveDocument(base.revision, newDocument)

    const temporary = seen.find((entry) => entry.filePath.includes('.homedash-'))
    expect(temporary?.mode).toBe(0o600)
    expect(temporary!.flags & constants.O_EXCL).toBe(constants.O_EXCL)
    expect(temporary!.flags & constants.O_CREAT).toBe(constants.O_CREAT)
    if (typeof constants.O_NOFOLLOW === 'number') {
      expect(temporary!.flags & constants.O_NOFOLLOW).toBe(constants.O_NOFOLLOW)
    }
  })
})

describe('BookmarkService current registry lookup', () => {
  it('finds only IDs in the latest successfully accepted host configuration', async () => {
    const { bookmarksPath } = await fixture([
      { group: 'Daily', name: 'First', url: 'https://first.example/deep?private=1' },
      { group: 'Daily', name: 'Second', url: 'https://second.example/' },
    ])
    const service = new BookmarkService(config(bookmarksPath))
    const initial = await service.load()
    const [first, second] = initial.data.bookmarks

    await expect(service.findCurrentById(first!.id)).resolves.toEqual(first)
    await expect(service.findCurrentById('ffffffffffffffff')).resolves.toBeNull()

    await replaceFile(bookmarksPath, '{ invalid json')
    await expect(service.findCurrentById(first!.id)).resolves.toEqual(first)

    await replaceFile(bookmarksPath, [{ group: 'Daily', name: 'Second', url: second!.url }])
    await expect(service.findCurrentById(first!.id)).resolves.toBeNull()
    const replacement = await service.load()
    await expect(service.findCurrentById(replacement.data.bookmarks[0]!.id)).resolves.toEqual(
      replacement.data.bookmarks[0],
    )
  })
})
