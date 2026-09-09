import { mkdtemp, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { BookmarkService } from './bookmarks'
import { loadConfig } from './config'

function config(bookmarksPath: string) {
  return loadConfig({ BOOKMARKS_PATH: bookmarksPath })
}

async function replaceFile(bookmarksPath: string, value: unknown, modifiedAtMs: number) {
  await writeFile(bookmarksPath, typeof value === 'string' ? value : JSON.stringify(value), 'utf8')
  const modifiedAt = new Date(modifiedAtMs)
  await utimes(bookmarksPath, modifiedAt, modifiedAt)
}

describe('BookmarkService current registry lookup', () => {
  it('finds only IDs in the latest successfully accepted host configuration', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'homedash-bookmark-registry-'))
    const bookmarksPath = path.join(dir, 'bookmarks.json')
    const firstModifiedAt = Date.now() - 10_000
    await replaceFile(
      bookmarksPath,
      [
        { group: 'Daily', name: 'First', url: 'https://first.example/deep?private=1' },
        { group: 'Daily', name: 'Second', url: 'https://second.example/' },
      ],
      firstModifiedAt,
    )
    const service = new BookmarkService(config(bookmarksPath))
    const initial = await service.load()
    const [first, second] = initial.data.bookmarks

    await expect(service.findCurrentById(first!.id)).resolves.toEqual(first)
    await expect(service.findCurrentById('ffffffffffffffff')).resolves.toBeNull()

    await replaceFile(bookmarksPath, '{ invalid json', firstModifiedAt + 1_000)
    await expect(service.findCurrentById(first!.id)).resolves.toEqual(first)

    await replaceFile(
      bookmarksPath,
      [{ group: 'Daily', name: 'Second', url: second!.url }],
      firstModifiedAt + 2_000,
    )
    await expect(service.findCurrentById(first!.id)).resolves.toBeNull()
    const replacement = await service.load()
    await expect(service.findCurrentById(replacement.data.bookmarks[0]!.id)).resolves.toEqual(
      replacement.data.bookmarks[0],
    )
  })
})
