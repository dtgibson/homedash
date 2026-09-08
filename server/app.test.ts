import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from './app'
import { loadConfig } from './config'

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

function testConfig(bookmarksPath: string) {
  return loadConfig({
    HOMEDASH_HOST: '127.0.0.1',
    HOMEDASH_PORT: '1910',
    SNOWRAVEN_URL: 'http://127.0.0.1:1620',
    LLMDASH_URL: 'http://127.0.0.1:8787',
    BOOKMARKS_PATH: bookmarksPath,
    HOME_LATITUDE: '37.7',
    HOME_LONGITUDE: '-122.4',
  })
}

describe('Fastify application boundary', () => {
  it('reports process health without probing or exposing upstream configuration', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'homedash-health-'))
    const app = await buildApp({
      config: testConfig(path.join(dir, 'bookmarks.json')),
      serveClient: false,
    })
    apps.push(app)
    const response = await app.inject({ method: 'GET', url: '/healthz' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true, service: 'homedash' })
    expect(response.body).not.toContain('8787')
    expect(response.headers['content-security-policy']).toContain("default-src 'self'")
  })

  it('keeps valid bookmarks in file order and safely reports omitted entries', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'homedash-bookmarks-'))
    const bookmarksPath = path.join(dir, 'bookmarks.json')
    await writeFile(
      bookmarksPath,
      JSON.stringify([
        { group: 'Daily', name: 'First', url: 'https://example.com/first' },
        { group: 'Daily', name: '', url: 'javascript:alert(1)' },
        { group: 'Birding', name: 'Second', url: 'https://example.com/second' },
      ]),
    )
    const app = await buildApp({ config: testConfig(bookmarksPath), serveClient: false })
    apps.push(app)
    const response = await app.inject({ method: 'GET', url: '/api/bookmarks' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data.bookmarks.map((bookmark: { name: string }) => bookmark.name)).toEqual([
      'First',
      'Second',
    ])
    expect(body.data.invalidEntryCount).toBe(1)
    expect(body.meta.issues[0].message).not.toContain('javascript')
  })

  it('copies llmdash remaining percentages and missing windows without re-deriving them', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'homedash-llm-'))
    const fetchMock = async () =>
      new Response(
        JSON.stringify({
          generatedAt: '2026-09-08T05:00:00.000Z',
          tools: [
            {
              source: 'claude-code',
              label: 'Claude Code',
              limits: {
                five_hour: {
                  remainingPct: 73,
                  resetsAt: '2026-09-08T07:00:00.000Z',
                  capturedAt: '2026-09-08T05:00:00.000Z',
                },
                seven_day: {
                  remainingPct: 42,
                  resetsAt: null,
                  capturedAt: '2026-09-08T05:00:00.000Z',
                },
              },
              freshness: null,
              limitsDiagnostic: null,
            },
            {
              source: 'codex',
              label: 'Codex',
              limits: { five_hour: null, seven_day: null },
              freshness: null,
              limitsDiagnostic: { reason: 'window-not-reported' },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    const app = await buildApp({
      config: testConfig(path.join(dir, 'bookmarks.json')),
      fetchImpl: fetchMock as typeof fetch,
      serveClient: false,
    })
    apps.push(app)
    const response = await app.inject({ method: 'GET', url: '/api/llmdash/summary' })
    const body = response.json()
    expect(response.statusCode).toBe(200)
    expect(body.data.providers[0].fiveHour.remainingPct).toBe(73)
    expect(body.data.providers[0].weekly.remainingPct).toBe(42)
    expect(body.data.providers[1].fiveHour).toBeNull()
    expect(body.meta.issues).toHaveLength(1)
  })

  it('rejects malformed coordinates without contacting an upstream', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'homedash-location-'))
    let calls = 0
    const app = await buildApp({
      config: testConfig(path.join(dir, 'bookmarks.json')),
      fetchImpl: (async () => {
        calls += 1
        return new Response('{}')
      }) as typeof fetch,
      serveClient: false,
    })
    apps.push(app)
    const response = await app.inject({
      method: 'POST',
      url: '/api/weather',
      payload: {
        kind: 'current',
        latitude: 900,
        longitude: 0,
        capturedAt: new Date().toISOString(),
      },
    })
    expect(response.statusCode).toBe(400)
    expect(calls).toBe(0)
  })
})
