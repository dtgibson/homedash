import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { bookmarkUrlSchema } from '../src/shared/contracts'
import { buildApp } from './app'
import { loadConfig } from './config'

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = []

const expectedSecurityHeaders = {
  'content-security-policy':
    "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action https://kagi.com/search",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'permissions-policy': 'geolocation=(self), camera=(), microphone=()',
  'cross-origin-resource-policy': 'same-origin',
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

function testConfig(bookmarksPath: string, llmdashLaunchUrl?: string) {
  return loadConfig({
    HOMEDASH_HOST: '127.0.0.1',
    HOMEDASH_PORT: '1910',
    HOMEDASH_ALLOWED_ORIGINS: 'http://127.0.0.1:1910,https://home.example.ts.net:1910',
    SNOWRAVEN_URL: 'http://127.0.0.1:1620',
    LLMDASH_URL: 'http://127.0.0.1:8787',
    ...(llmdashLaunchUrl === undefined ? {} : { LLMDASH_LAUNCH_URL: llmdashLaunchUrl }),
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
    expect(response.headers).toMatchObject(expectedSecurityHeaders)
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

  it('applies the shared bookmark URL policy at the server boundary', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'homedash-bookmark-policy-'))
    const bookmarksPath = path.join(dir, 'bookmarks.json')
    const urls = [
      'http://example.com',
      'https://example.com/path?query=birds%20today#recent-sightings',
      'HTTPS://Example.com/case-insensitive-scheme',
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
    ]
    await writeFile(
      bookmarksPath,
      JSON.stringify(
        urls.map((url, index) => ({ group: 'Policy', name: `Candidate ${index}`, url })),
      ),
    )
    const app = await buildApp({ config: testConfig(bookmarksPath), serveClient: false })
    apps.push(app)

    const response = await app.inject({ method: 'GET', url: '/api/bookmarks' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    const expectedUrls = urls.filter((url) => bookmarkUrlSchema.safeParse(url).success)
    expect(body.data.bookmarks.map((bookmark: { url: string }) => bookmark.url)).toEqual(
      expectedUrls,
    )
    expect(body.data.invalidEntryCount).toBe(urls.length - expectedUrls.length)
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

  it('redirects only the exact fixed eBird launch routes with no-store responses', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'homedash-launch-ebird-'))
    const app = await buildApp({
      config: testConfig(path.join(dir, 'bookmarks.json')),
      serveClient: false,
    })
    apps.push(app)

    const myEbird = await app.inject({ method: 'GET', url: '/launch/ebird/my-ebird' })
    expect(myEbird.statusCode).toBe(302)
    expect(myEbird.headers.location).toBe('https://ebird.org/myebird')
    expect(myEbird.headers['cache-control']).toBe('no-store')

    const species = await app.inject({ method: 'GET', url: '/launch/ebird/map/amredst' })
    expect(species.statusCode).toBe(302)
    expect(species.headers.location).toBe('https://ebird.org/map/amredst')
    expect(species.headers['cache-control']).toBe('no-store')
  })

  it.each([
    '/launch/ebird/map/ab',
    '/launch/ebird/map/UPPER',
    '/launch/ebird/map/https:%2F%2Fevil.invalid',
    '/launch/ebird/map/amredst?next=https%3A%2F%2Fevil.invalid',
    '/launch/ebird/map',
    '/launch/ebird/map/%2e%2e%2Fmy-ebird',
  ])('never redirects a malformed or injected species-map request: %s', async (url) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'homedash-launch-reject-'))
    const app = await buildApp({
      config: testConfig(path.join(dir, 'bookmarks.json')),
      serveClient: false,
    })
    apps.push(app)
    const response = await app.inject({ method: 'GET', url })
    expect(response.statusCode).toBeGreaterThanOrEqual(400)
    expect(response.statusCode).toBeLessThan(500)
    expect(response.headers.location).toBeUndefined()
    expect(response.body).not.toContain('evil.invalid')
  })

  it('keeps the private llmdash launch destination separate from source loading', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'homedash-launch-llmdash-'))
    let upstreamCalls = 0
    const config = testConfig(
      path.join(dir, 'bookmarks.json'),
      'https://dashboard.invalid/limits?window=weekly',
    )
    const app = await buildApp({
      config,
      fetchImpl: (async () => {
        upstreamCalls += 1
        return new Response('unavailable', { status: 503 })
      }) as typeof fetch,
      serveClient: false,
    })
    apps.push(app)

    expect(config.llmdashUrl).toBe('http://127.0.0.1:8787')
    const launch = await app.inject({ method: 'GET', url: '/launch/llmdash' })
    expect(launch.statusCode).toBe(302)
    expect(launch.headers.location).toBe('https://dashboard.invalid/limits?window=weekly')
    expect(launch.headers['cache-control']).toBe('no-store')
    expect(upstreamCalls).toBe(0)
  })

  it.each([
    [undefined, 'missing-configuration'],
    ['javascript:alert(1)', 'invalid-configuration'],
    ['https://user:secret@dashboard.invalid', 'invalid-configuration'],
    ['https://dashboard.invalid/#private', 'invalid-configuration'],
  ] as const)('fails a missing or invalid llmdash launch setting safely', async (setting, code) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'homedash-launch-config-'))
    const app = await buildApp({
      config: testConfig(path.join(dir, 'bookmarks.json'), setting),
      serveClient: false,
    })
    apps.push(app)
    const response = await app.inject({ method: 'GET', url: '/launch/llmdash' })
    expect(response.statusCode).toBe(503)
    expect(response.headers.location).toBeUndefined()
    expect(response.json()).toMatchObject({ schemaVersion: 1, code, retryable: false })
    expect(response.body).not.toContain('dashboard.invalid')
    expect(response.body).not.toContain('secret')
  })

  it('rejects query injection and unsupported methods on fixed launch actions', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'homedash-launch-method-'))
    const app = await buildApp({
      config: testConfig(path.join(dir, 'bookmarks.json'), 'https://dashboard.invalid'),
      serveClient: false,
    })
    apps.push(app)
    for (const request of [
      { method: 'GET' as const, url: '/launch/ebird/my-ebird?url=https://evil.invalid' },
      { method: 'GET' as const, url: '/launch/llmdash?next=https://evil.invalid' },
      { method: 'POST' as const, url: '/launch/llmdash' },
      { method: 'GET' as const, url: '/launch/unknown' },
    ]) {
      const response = await app.inject(request)
      expect(response.statusCode).toBeGreaterThanOrEqual(400)
      expect(response.statusCode).toBeLessThan(500)
      expect(response.headers.location).toBeUndefined()
      expect(response.body).not.toContain('evil.invalid')
    }
  })

  it.each(['/launch/ebird/map/%', `/launch/ebird/map/${'a'.repeat(101)}`])(
    'bounds framework routing errors without reflecting launch path input: %s',
    async (url) => {
      const dir = await mkdtemp(path.join(tmpdir(), 'homedash-launch-framework-'))
      const app = await buildApp({
        config: testConfig(path.join(dir, 'bookmarks.json')),
        serveClient: false,
      })
      apps.push(app)

      const response = await app.inject({ method: 'GET', url })
      expect(response.statusCode).toBe(400)
      expect(response.headers.location).toBeUndefined()
      expect(response.json()).toEqual({
        schemaVersion: 1,
        code: 'invalid-configuration',
        message: 'The launch request is invalid.',
        retryable: false,
      })
      expect(response.headers).toMatchObject(expectedSecurityHeaders)
      expect(response.body).not.toContain(url)
    },
  )

  it('applies every security header to non-launch framework routing errors', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'homedash-framework-headers-'))
    const app = await buildApp({
      config: testConfig(path.join(dir, 'bookmarks.json')),
      serveClient: false,
    })
    apps.push(app)

    const response = await app.inject({ method: 'GET', url: '/api/%' })
    expect(response.statusCode).toBe(400)
    expect(response.headers.location).toBeUndefined()
    expect(response.headers).toMatchObject(expectedSecurityHeaders)
    expect(response.json()).toEqual({
      schemaVersion: 1,
      code: 'invalid-configuration',
      message: 'The request URL is invalid.',
      retryable: false,
    })
    expect(response.body.length).toBeLessThan(180)
    expect(response.body).not.toContain('/api/%')
    expect(response.body).not.toContain('%')
    expect(response.body).not.toContain('FST_ERR_BAD_URL')
    expect(response.body).not.toContain('valid url component')
    expect(response.body).not.toContain('stack')
  })

  it.each(['/launch/ebird/my-ebird', '/launch/ebird/map/amredst', '/launch/llmdash'])(
    'does not expose a redirecting HEAD sibling for %s',
    async (url) => {
      const dir = await mkdtemp(path.join(tmpdir(), 'homedash-launch-head-'))
      const app = await buildApp({
        config: testConfig(path.join(dir, 'bookmarks.json'), 'https://dashboard.invalid'),
        serveClient: false,
      })
      apps.push(app)

      const response = await app.inject({ method: 'HEAD', url })
      expect(response.statusCode).toBe(404)
      expect(response.headers.location).toBeUndefined()
    },
  )

  it.each(['/launch', '/launch?next=https%3A%2F%2Fevil.invalid'])(
    'reserves the incomplete launch namespace instead of serving the SPA: %s',
    async (url) => {
      const dir = await mkdtemp(path.join(tmpdir(), 'homedash-launch-namespace-'))
      const app = await buildApp({
        config: testConfig(path.join(dir, 'bookmarks.json')),
      })
      apps.push(app)

      const response = await app.inject({ method: 'GET', url })
      expect(response.statusCode).toBe(404)
      expect(response.headers.location).toBeUndefined()
      expect(response.json()).toEqual({
        schemaVersion: 1,
        code: 'not-found',
        message: 'Not found.',
      })
      expect(response.body).not.toContain('evil.invalid')
    },
  )
})

const editableDocument = {
  schemaVersion: 1 as const,
  sections: [
    {
      name: 'Daily',
      bookmarks: [{ name: 'First', url: 'https://first.example/' }],
    },
  ],
}

async function documentApp() {
  const dir = await mkdtemp(path.join(tmpdir(), 'homedash-document-api-'))
  const bookmarksPath = path.join(dir, 'bookmarks.json')
  await writeFile(bookmarksPath, JSON.stringify(editableDocument))
  const app = await buildApp({ config: testConfig(bookmarksPath), serveClient: false })
  apps.push(app)
  return { app, bookmarksPath }
}

function mutationHeaders(overrides: Record<string, string> = {}) {
  return {
    host: '127.0.0.1:1910',
    'content-type': 'application/json',
    'x-homedash-bookmark-write': '1',
    ...overrides,
  }
}

describe('bookmark document API boundary', () => {
  it('returns a fresh strict editable document without caching or rewriting source bytes', async () => {
    const legacy = [
      { group: 'Daily', name: 'First', url: 'https://first.example/' },
      { group: 'Projects', name: 'Code', url: 'https://code.example/' },
      { group: 'Daily', name: 'Second', url: 'https://second.example/' },
    ]
    const dir = await mkdtemp(path.join(tmpdir(), 'homedash-document-get-'))
    const bookmarksPath = path.join(dir, 'bookmarks.json')
    const original = JSON.stringify(legacy, null, 2)
    await writeFile(bookmarksPath, original)
    const app = await buildApp({ config: testConfig(bookmarksPath), serveClient: false })
    apps.push(app)

    const response = await app.inject({
      method: 'GET',
      url: '/api/bookmarks/document',
      headers: { host: '127.0.0.1:1910' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['content-type']).toMatch(/^application\/json/)
    expect(response.headers).toMatchObject(expectedSecurityHeaders)
    expect(response.json()).toMatchObject({
      schemaVersion: 1,
      revision: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      document: {
        schemaVersion: 1,
        sections: [
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
        ],
      },
    })
    expect(
      await import('node:fs/promises').then(({ readFile }) => readFile(bookmarksPath, 'utf8')),
    ).toBe(original)
  })

  it('keeps partial legacy content available to the dashboard while the editor stays read-only', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'homedash-document-partial-'))
    const bookmarksPath = path.join(dir, 'bookmarks.json')
    await writeFile(
      bookmarksPath,
      JSON.stringify([
        { group: 'Daily', name: 'Good', url: 'https://good.example/' },
        { group: 'Daily', name: '', url: 'javascript:alert(1)' },
      ]),
    )
    const app = await buildApp({ config: testConfig(bookmarksPath), serveClient: false })
    apps.push(app)

    const dashboard = await app.inject({ method: 'GET', url: '/api/bookmarks' })
    const editor = await app.inject({
      method: 'GET',
      url: '/api/bookmarks/document',
      headers: { host: '127.0.0.1:1910' },
    })

    expect(dashboard.statusCode).toBe(200)
    expect(dashboard.json().data).toMatchObject({ invalidEntryCount: 1 })
    expect(editor.statusCode).toBe(409)
    expect(editor.headers['cache-control']).toBe('no-store')
    expect(editor.json()).toEqual({
      schemaVersion: 1,
      code: 'bookmark-source-invalid',
      message: 'The bookmark file is not valid for editing.',
      retryable: false,
    })
    expect(editor.body).not.toContain('javascript')
    expect(editor.body).not.toContain(bookmarksPath)
  })

  it('replaces the complete document and returns the authoritative display projection', async () => {
    const { app, bookmarksPath } = await documentApp()
    const get = await app.inject({
      method: 'GET',
      url: '/api/bookmarks/document',
      headers: { host: '127.0.0.1:1910' },
    })
    const candidate = {
      schemaVersion: 1,
      sections: [
        { name: 'Empty', bookmarks: [] },
        {
          name: 'Later',
          bookmarks: [{ name: 'Third', url: 'https://third.example/' }],
        },
      ],
    }

    const put = await app.inject({
      method: 'PUT',
      url: '/api/bookmarks/document',
      headers: mutationHeaders({ origin: 'http://127.0.0.1:1910' }),
      payload: {
        schemaVersion: 1,
        baseRevision: get.json().revision,
        document: candidate,
      },
    })

    expect(put.statusCode).toBe(200)
    expect(put.headers['cache-control']).toBe('no-store')
    expect(put.json()).toMatchObject({
      document: candidate,
      display: {
        data: {
          sections: ['Empty', 'Later'],
          bookmarks: [{ group: 'Later', name: 'Third', order: 0 }],
          invalidEntryCount: 0,
        },
      },
    })
    expect(
      JSON.parse(
        await import('node:fs/promises').then(({ readFile }) => readFile(bookmarksPath, 'utf8')),
      ),
    ).toEqual(candidate)
  })

  it('enforces whole-document conflicts while accepting an exact idempotent replay', async () => {
    const { app } = await documentApp()
    const base = await app.inject({
      method: 'GET',
      url: '/api/bookmarks/document',
      headers: { host: '127.0.0.1:1910' },
    })
    const candidate = {
      schemaVersion: 1,
      sections: [{ name: 'New', bookmarks: [] }],
    }
    const body = {
      schemaVersion: 1,
      baseRevision: base.json().revision,
      document: candidate,
    }

    const first = await app.inject({
      method: 'PUT',
      url: '/api/bookmarks/document',
      headers: mutationHeaders(),
      payload: body,
    })
    const staleDifferent = await app.inject({
      method: 'PUT',
      url: '/api/bookmarks/document',
      headers: mutationHeaders(),
      payload: { ...body, document: editableDocument },
    })
    const idempotent = await app.inject({
      method: 'PUT',
      url: '/api/bookmarks/document',
      headers: mutationHeaders(),
      payload: body,
    })

    expect(first.statusCode).toBe(200)
    expect(staleDifferent.statusCode).toBe(409)
    expect(staleDifferent.json()).toMatchObject({
      code: 'bookmark-revision-conflict',
      retryable: false,
    })
    expect(idempotent.statusCode).toBe(200)
    expect(idempotent.json().revision).toBe(first.json().revision)
  })

  it('returns every applicable candidate field error without writing partial content', async () => {
    const { app, bookmarksPath } = await documentApp()
    const base = await app.inject({
      method: 'GET',
      url: '/api/bookmarks/document',
      headers: { host: '127.0.0.1:1910' },
    })
    const before = await import('node:fs/promises').then(({ readFile }) =>
      readFile(bookmarksPath, 'utf8'),
    )

    const response = await app.inject({
      method: 'PUT',
      url: '/api/bookmarks/document',
      headers: mutationHeaders(),
      payload: {
        schemaVersion: 1,
        baseRevision: base.json().revision,
        document: {
          schemaVersion: 1,
          sections: [
            {
              name: 'Daily',
              bookmarks: [{ name: '', url: 'javascript:alert(1)', 'private-session-key': true }],
            },
            { name: ' daily ', bookmarks: [] },
          ],
        },
      },
    })

    expect(response.statusCode).toBe(422)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.json().fieldErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/document/sections/0/bookmarks/0',
          code: 'unknown-property',
        }),
        expect.objectContaining({
          path: '/document/sections/0/bookmarks/0/name',
          code: 'required',
        }),
        expect.objectContaining({
          path: '/document/sections/0/bookmarks/0/url',
          code: 'invalid-url',
        }),
        expect.objectContaining({ path: '/document/sections/0/name', code: 'duplicate' }),
        expect.objectContaining({ path: '/document/sections/1/name', code: 'duplicate' }),
      ]),
    )
    expect(response.body).not.toContain('javascript')
    expect(response.body).not.toContain('private-session-key')
    expect(
      await import('node:fs/promises').then(({ readFile }) => readFile(bookmarksPath, 'utf8')),
    ).toBe(before)
  })

  it.each([
    {
      name: 'missing write marker',
      headers: { host: '127.0.0.1:1910', 'content-type': 'application/json' },
      expectedStatus: 403,
      expectedCode: 'bookmark-request-forbidden',
    },
    {
      name: 'cross-origin Origin',
      headers: mutationHeaders({ origin: 'https://evil.invalid' }),
      expectedStatus: 403,
      expectedCode: 'bookmark-request-forbidden',
    },
    {
      name: 'cross-site fetch metadata',
      headers: mutationHeaders({ 'sec-fetch-site': 'cross-site' }),
      expectedStatus: 403,
      expectedCode: 'bookmark-request-forbidden',
    },
    {
      name: 'unsupported media type',
      headers: {
        host: '127.0.0.1:1910',
        'content-type': 'text/plain',
        'x-homedash-bookmark-write': '1',
      },
      expectedStatus: 415,
      expectedCode: 'bookmark-media-type-unsupported',
    },
    {
      name: 'compressed body',
      headers: mutationHeaders({ 'content-encoding': 'gzip' }),
      expectedStatus: 415,
      expectedCode: 'bookmark-media-type-unsupported',
    },
  ])('rejects $name before mutation with the editor error contract', async (testCase) => {
    const { app, bookmarksPath } = await documentApp()
    const before = await import('node:fs/promises').then(({ readFile }) =>
      readFile(bookmarksPath, 'utf8'),
    )

    const response = await app.inject({
      method: 'PUT',
      url: '/api/bookmarks/document',
      headers: testCase.headers,
      payload: '{}',
    })

    expect(response.statusCode).toBe(testCase.expectedStatus)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.json()).toMatchObject({
      schemaVersion: 1,
      code: testCase.expectedCode,
      retryable: false,
    })
    expect(
      await import('node:fs/promises').then(({ readFile }) => readFile(bookmarksPath, 'utf8')),
    ).toBe(before)
  })

  it('allows exact configured Tailscale Host and Origin without trusting forwarding headers', async () => {
    const { app } = await documentApp()
    const base = await app.inject({
      method: 'GET',
      url: '/api/bookmarks/document',
      headers: { host: 'home.example.ts.net:1910' },
    })
    const response = await app.inject({
      method: 'PUT',
      url: '/api/bookmarks/document',
      headers: mutationHeaders({
        host: 'home.example.ts.net:1910',
        origin: 'https://home.example.ts.net:1910',
        'x-forwarded-proto': 'http',
        'x-forwarded-host': 'attacker.invalid',
        'sec-fetch-site': 'same-origin',
      }),
      payload: {
        schemaVersion: 1,
        baseRevision: base.json().revision,
        document: editableDocument,
      },
    })

    expect(response.statusCode).toBe(200)
  })

  it('rejects attacker Hosts for GET and PUT despite matching origins and spoofed forwarding', async () => {
    const { app } = await documentApp()
    const headers = {
      host: 'attacker.invalid',
      origin: 'https://attacker.invalid',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'home.example.ts.net:1910',
      'sec-fetch-site': 'same-origin',
    }
    const get = await app.inject({
      method: 'GET',
      url: '/api/bookmarks/document',
      headers,
    })
    const put = await app.inject({
      method: 'PUT',
      url: '/api/bookmarks/document',
      headers: mutationHeaders(headers),
      payload: '{}',
    })

    for (const response of [get, put]) {
      expect(response.statusCode).toBe(403)
      expect(response.json()).toMatchObject({ code: 'bookmark-request-forbidden' })
    }
  })

  it('rejects a supplied GET Origin that is not the configured origin for its Host', async () => {
    const { app } = await documentApp()
    const response = await app.inject({
      method: 'GET',
      url: '/api/bookmarks/document',
      headers: {
        host: '127.0.0.1:1910',
        origin: 'https://attacker.invalid',
        'sec-fetch-site': 'cross-site',
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ code: 'bookmark-request-forbidden' })
  })

  it('bounds public field errors and every public error path', async () => {
    const { app } = await documentApp()
    const base = await app.inject({
      method: 'GET',
      url: '/api/bookmarks/document',
      headers: { host: '127.0.0.1:1910' },
    })
    const response = await app.inject({
      method: 'PUT',
      url: '/api/bookmarks/document',
      headers: mutationHeaders(),
      payload: {
        schemaVersion: 1,
        baseRevision: base.json().revision,
        document: {
          schemaVersion: 1,
          sections: [
            {
              name: 'Daily',
              bookmarks: Array.from({ length: 101 }, (_, index) => ({
                name: '',
                url: 'invalid',
                [`sensitive-${index}`]: true,
              })),
            },
          ],
        },
      },
    })

    expect(response.statusCode).toBe(422)
    const fieldErrors = response.json().fieldErrors as Array<{ path: string }>
    expect(fieldErrors).toHaveLength(128)
    expect(fieldErrors.every((error) => error.path.length <= 160)).toBe(true)
    expect(response.body).not.toContain('sensitive-')
  })

  it.each([
    ['GET', '/api/bookmarks/document?revision=private', 404],
    ['POST', '/api/bookmarks/document', 405],
    ['HEAD', '/api/bookmarks/document', 405],
    ['GET', '/api/bookmarks/document/extra', 404],
  ] as const)('reserves the exact document route: %s %s', async (method, url, statusCode) => {
    const { app } = await documentApp()
    const response = await app.inject({ method, url })
    expect(response.statusCode).toBe(statusCode)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.json()).toMatchObject({
      schemaVersion: 1,
      code: 'bookmark-request-invalid',
    })
    expect(response.body).not.toContain('private')
  })

  it('maps malformed wrappers, malformed JSON, and bounded oversized bodies safely', async () => {
    const { app } = await documentApp()

    const wrapper = await app.inject({
      method: 'PUT',
      url: '/api/bookmarks/document',
      headers: mutationHeaders(),
      payload: { schemaVersion: 1, document: editableDocument, extra: true },
    })
    const malformed = await app.inject({
      method: 'PUT',
      url: '/api/bookmarks/document',
      headers: mutationHeaders(),
      payload: '{not json',
    })
    const underRouteLimit = await app.inject({
      method: 'PUT',
      url: '/api/bookmarks/document',
      headers: mutationHeaders(),
      payload: JSON.stringify({ extra: 'x'.repeat(40_000) }),
    })
    const overRouteLimit = await app.inject({
      method: 'PUT',
      url: '/api/bookmarks/document',
      headers: mutationHeaders(),
      payload: JSON.stringify({ extra: 'x'.repeat(66_000) }),
    })

    expect(wrapper.statusCode).toBe(400)
    expect(malformed.statusCode).toBe(400)
    expect(underRouteLimit.statusCode).toBe(400)
    expect(overRouteLimit.statusCode).toBe(413)
    for (const response of [wrapper, malformed, underRouteLimit, overRouteLimit]) {
      expect(response.headers['cache-control']).toBe('no-store')
      expect(response.json()).toMatchObject({ schemaVersion: 1 })
      expect(response.body).not.toContain('FST_ERR')
      expect(response.body).not.toContain('x'.repeat(100))
    }
  })

  it('keeps the favicon namespace behavior separate from document errors', async () => {
    const { app } = await documentApp()
    const documentResponse = await app.inject({
      method: 'GET',
      url: '/api/bookmarks/document?bad=private',
    })
    const faviconResponse = await app.inject({
      method: 'PUT',
      url: '/api/bookmarks/ffffffffffffffff/favicon',
    })

    expect(documentResponse.statusCode).toBe(404)
    expect(documentResponse.headers['content-type']).toMatch(/^application\/json/)
    expect(documentResponse.json().code).toBe('bookmark-request-invalid')
    expect(faviconResponse.statusCode).toBe(404)
    expect(faviconResponse.body).toBe('')
    expect(faviconResponse.headers['cache-control']).toBe('no-store')
  })
})
