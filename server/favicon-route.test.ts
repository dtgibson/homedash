import { mkdtemp, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { deflateSync } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from './app'
import { BookmarkService } from './bookmarks'
import { loadConfig } from './config'

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function png() {
  const crc32 = (bytes: Uint8Array) => {
    let crc = 0xffffffff
    for (const byte of bytes) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
    return (crc ^ 0xffffffff) >>> 0
  }
  const chunk = (name: string, data: number[]) => {
    const value = Buffer.alloc(12 + data.length)
    value.writeUInt32BE(data.length, 0)
    value.write(name, 4, 4, 'ascii')
    Buffer.from(data).copy(value, 8)
    value.writeUInt32BE(crc32(value.subarray(4, 8 + data.length)), 8 + data.length)
    return value
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]),
    chunk('IDAT', [...deflateSync(Buffer.from([0, 0, 0, 0, 0]))]),
    chunk('IEND', []),
  ])
}

async function fixture(fetchImpl: typeof fetch) {
  const dir = await mkdtemp(path.join(tmpdir(), 'homedash-favicon-route-'))
  const bookmarksPath = path.join(dir, 'bookmarks.json')
  await writeFile(
    bookmarksPath,
    JSON.stringify([
      {
        group: 'Daily',
        name: 'Private destination',
        url: 'https://icons.example/private/path?token=host-secret#fragment',
      },
    ]),
  )
  const app = await buildApp({
    config: loadConfig({ BOOKMARKS_PATH: bookmarksPath }),
    fetchImpl,
    serveClient: false,
  })
  apps.push(app)
  const bookmarks = await app.inject({ method: 'GET', url: '/api/bookmarks' })
  const bookmark = bookmarks.json().data.bookmarks[0]
  const id = bookmark.id as string
  return { app, bookmarksPath, bookmark, id }
}

describe('favicon HTTP resource', () => {
  it('serves validated bytes with normalized private headers and unchanged CSP', async () => {
    const bytes = png()
    const fetchMock = vi.fn(
      async () =>
        new Response(bytes, {
          status: 200,
          headers: {
            'content-type': 'application/octet-stream',
            'cache-control': 'public, max-age=1',
            'set-cookie': 'upstream=secret',
            server: 'private-upstream',
            location: 'https://evil.invalid',
          },
        }),
    )
    const { app, id } = await fixture(fetchMock as typeof fetch)
    const response = await app.inject({
      method: 'GET',
      url: `/api/bookmarks/${id}/favicon`,
      headers: {
        cookie: 'browser=secret',
        authorization: 'Bearer browser-secret',
        referer: 'https://browser.example/private',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.rawPayload).toEqual(bytes)
    expect(response.headers).toMatchObject({
      'content-type': 'image/png',
      'content-length': String(bytes.byteLength),
      'cache-control': 'private, max-age=86400',
      'x-content-type-options': 'nosniff',
      'cross-origin-resource-policy': 'same-origin',
      'referrer-policy': 'no-referrer',
      'content-security-policy': expect.stringContaining("img-src 'self' data:"),
    })
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(response.headers.location).toBeUndefined()
    expect(response.headers.server).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]![0].toString()).toBe('https://icons.example/favicon.ico')
    expect(fetchMock.mock.calls[0]![1]?.headers).toBeUndefined()
    expect(response.body).not.toContain('host-secret')
    expect(response.body).not.toContain('browser-secret')
  })

  it.each(['HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] as const)(
    'returns an empty no-store 404 for %s without an upstream request',
    async (method) => {
      const fetchMock = vi.fn(async () => new Response(png()))
      const { app, id } = await fixture(fetchMock as typeof fetch)
      const response = await app.inject({ method, url: `/api/bookmarks/${id}/favicon` })
      expect(response.statusCode).toBe(404)
      expect(response.body).toBe('')
      expect(response.headers['cache-control']).toBe('no-store')
      expect(response.headers.location).toBeUndefined()
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it.each([
    '/api/bookmarks/not-an-id/favicon',
    '/api/bookmarks/ABCDEF0123456789/favicon',
    '/api/bookmarks/0123456789abcdef/favicon?url=https%3A%2F%2Fevil.invalid',
    '/api/bookmarks/0123456789abcdef%2F..%2Ffavicon',
    '/api/bookmarks/%/favicon',
  ])('returns an empty no-store 404 for malformed namespace input: %s', async (url) => {
    const fetchMock = vi.fn(async () => new Response(png()))
    const { app } = await fixture(fetchMock as typeof fetch)
    const response = await app.inject({ method: 'GET', url })
    expect(response.statusCode).toBe(404)
    expect(response.body).toBe('')
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers.location).toBeUndefined()
    expect(response.body).not.toContain('evil.invalid')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects unknown and removed current IDs before cache or upstream lookup', async () => {
    const fetchMock = vi.fn(
      async () => new Response(png(), { status: 200, headers: { 'content-type': 'image/png' } }),
    )
    const { app, bookmarksPath, id } = await fixture(fetchMock as typeof fetch)

    const unknown = await app.inject({
      method: 'GET',
      url: '/api/bookmarks/ffffffffffffffff/favicon',
    })
    expect(unknown.statusCode).toBe(404)
    expect(unknown.body).toBe('')
    expect(unknown.headers['cache-control']).toBe('no-store')
    expect(fetchMock).not.toHaveBeenCalled()

    const first = await app.inject({ method: 'GET', url: `/api/bookmarks/${id}/favicon` })
    expect(first.statusCode).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await writeFile(bookmarksPath, '[]')
    const changedAt = new Date(Date.now() + 2_000)
    await utimes(bookmarksPath, changedAt, changedAt)
    const removed = await app.inject({ method: 'GET', url: `/api/bookmarks/${id}/favicon` })
    expect(removed.statusCode).toBe(404)
    expect(removed.body).toBe('')
    expect(removed.headers['cache-control']).toBe('no-store')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('turns rejected upstream content into an empty private negative response', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('<title>private upstream error</title>', {
          status: 200,
          headers: {
            'content-type': 'text/html',
            location: 'https://evil.invalid/private',
            'set-cookie': 'secret=value',
          },
        }),
    )
    const { app, id } = await fixture(fetchMock as typeof fetch)
    const response = await app.inject({ method: 'GET', url: `/api/bookmarks/${id}/favicon` })
    expect(response.statusCode).toBe(404)
    expect(response.body).toBe('')
    expect(response.headers['cache-control']).toBe('private, max-age=900')
    expect(response.headers.location).toBeUndefined()
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(response.body).not.toContain('private upstream error')
    expect(response.body).not.toContain('evil.invalid')
  })

  it('returns by the route deadline when current-bookmark lookup is late and never starts a late fetch', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => new Response(png()))
    const { app, bookmark, id } = await fixture(fetchMock as typeof fetch)
    const lookup = vi
      .spyOn(BookmarkService.prototype, 'findCurrentById')
      .mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 2_100))
        return bookmark
      })

    const startedAt = Date.now()
    const pending = app.inject({ method: 'GET', url: `/api/bookmarks/${id}/favicon` })
    await vi.advanceTimersByTimeAsync(2_000)
    const response = await pending

    expect(Date.now() - startedAt).toBeLessThanOrEqual(2_000)
    expect(response.statusCode).toBe(404)
    expect(response.body).toBe('')
    expect(response.headers['cache-control']).toBe('no-store')
    expect(fetchMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(100)
    expect(lookup).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('gives the resolver only the time remaining after current-bookmark lookup', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined))
    const { app, bookmark, id } = await fixture(fetchMock as typeof fetch)
    vi.spyOn(BookmarkService.prototype, 'findCurrentById').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_200))
      return bookmark
    })

    const startedAt = Date.now()
    const pending = app.inject({ method: 'GET', url: `/api/bookmarks/${id}/favicon` })
    await vi.advanceTimersByTimeAsync(1_200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(800)
    const response = await pending

    expect(Date.now() - startedAt).toBeLessThanOrEqual(2_000)
    expect(response.statusCode).toBe(404)
    expect(response.body).toBe('')
    expect(response.headers['cache-control']).toBe('private, max-age=900')
  })
})
