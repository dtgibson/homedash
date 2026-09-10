import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { tideEnvelopeSchema } from '../src/shared/contracts'
import { buildApp } from './app'
import { loadConfig } from './config'

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = []
const location = {
  kind: 'current' as const,
  latitude: 37.771954,
  longitude: -122.30026,
  capturedAt: '2026-09-09T18:59:00.000Z',
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

async function testConfig(tide = true) {
  const directory = await mkdtemp(path.join(tmpdir(), 'homedash-tide-route-'))
  return loadConfig({
    BOOKMARKS_PATH: path.join(directory, 'bookmarks.json'),
    ...(tide ? { TIDE_STATION_ID: '9414290', TIDE_STATION_LABEL: 'Alameda' } : {}),
  })
}

function noaaFetch() {
  const now = Math.floor(Date.now() / 60_000) * 60_000
  const date = new Date(now)
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const dayEnd = dayStart + 24 * 3_600_000 - 6 * 60_000
  const nextTurn = now + 2 * 3_600_000
  const providerTime = (at: number) => new Date(at).toISOString().slice(0, 16).replace('T', ' ')
  const points = [
    ...new Set([
      dayStart - 6 * 60_000,
      dayStart,
      now - 6 * 60_000,
      now,
      now + 6 * 60_000,
      nextTurn,
      nextTurn + 6 * 60_000,
      dayEnd,
    ]),
  ]
    .sort((left, right) => left - right)
    .map((at, index) => ({ t: providerTime(at), v: String(0.8 + index * 0.2) }))
  return vi.fn(async (input: string | URL) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/stations.json')) {
      return Response.json({
        stations: [
          {
            id: '9414290',
            name: 'San Francisco',
            lat: 37.806305,
            lng: -122.46589,
            tidal: true,
            observedst: true,
          },
          {
            id: '9414750',
            name: 'Alameda',
            lat: 37.771954,
            lng: -122.30026,
            tidal: true,
            observedst: true,
          },
        ],
      })
    }
    const product = url.searchParams.get('product')
    if (product === 'water_level') {
      return Response.json({
        metadata: {
          id: url.searchParams.get('station'),
          name: 'Selected station',
          lat: '37.8063',
          lon: '-122.4659',
        },
        data: [
          {
            t: providerTime(now - 6 * 60_000),
            v: '2.0',
            s: '0.02',
            f: '0,0,0,0',
            q: 'v',
          },
          { t: providerTime(now), v: '2.1', s: '0.02', f: '0,0,0,0', q: 'v' },
        ],
      })
    }
    if (url.searchParams.get('interval') === 'hilo') {
      return Response.json({
        predictions: [
          { t: providerTime(now - 2 * 3_600_000), v: '0.4', type: 'L' },
          { t: providerTime(nextTurn), v: '5.4', type: 'H' },
        ],
      })
    }
    return Response.json({
      predictions: points,
    })
  })
}

describe('tide API boundary', () => {
  it('accepts the shared location and returns no-store normalized data without the station ID', async () => {
    const fetchMock = noaaFetch()
    const app = await buildApp({
      config: await testConfig(),
      fetchImpl: fetchMock as typeof fetch,
      serveClient: false,
    })
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/tide',
      headers: { 'content-type': 'application/json' },
      payload: { location, timeZone: 'UTC' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(tideEnvelopeSchema.safeParse(response.json()).success).toBe(true)
    expect(response.body).toContain('Alameda')
    expect(response.body).not.toContain('9414290')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it.each([
    {
      title: 'query strings',
      request: {
        method: 'POST' as const,
        url: '/api/tide?station=evil',
        headers: { 'content-type': 'application/json' },
        payload: { location, timeZone: 'America/Los_Angeles' },
      },
      status: 400,
    },
    {
      title: 'unknown body fields',
      request: {
        method: 'POST' as const,
        url: '/api/tide',
        headers: { 'content-type': 'application/json' },
        payload: { location, timeZone: 'America/Los_Angeles', station: 'evil' },
      },
      status: 400,
    },
    {
      title: 'invalid time zones',
      request: {
        method: 'POST' as const,
        url: '/api/tide',
        headers: { 'content-type': 'application/json' },
        payload: { location, timeZone: 'Invalid/Zone' },
      },
      status: 400,
    },
    {
      title: 'non-JSON bodies',
      request: {
        method: 'POST' as const,
        url: '/api/tide',
        headers: { 'content-type': 'text/plain' },
        payload: 'America/Los_Angeles',
      },
      status: 415,
    },
    {
      title: 'unsupported methods',
      request: { method: 'GET' as const, url: '/api/tide' },
      status: 405,
    },
  ])('rejects $title without contacting NOAA', async ({ request, status }) => {
    const fetchMock = noaaFetch()
    const app = await buildApp({
      config: await testConfig(),
      fetchImpl: fetchMock as typeof fetch,
      serveClient: false,
    })
    apps.push(app)

    const response = await app.inject(request)

    expect(response.statusCode).toBe(status)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.json()).toMatchObject({
      schemaVersion: 1,
      code: 'invalid-configuration',
      retryable: false,
    })
    expect(response.body).not.toContain('evil')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('automatically selects the nearest eligible station when no private override exists', async () => {
    const fetchMock = noaaFetch()
    const app = await buildApp({
      config: await testConfig(false),
      fetchImpl: fetchMock as typeof fetch,
      serveClient: false,
    })
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/tide',
      headers: { 'content-type': 'application/json' },
      payload: { location, timeZone: 'America/Los_Angeles' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('Alameda')
    expect(response.body).not.toContain('9414750')
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})
