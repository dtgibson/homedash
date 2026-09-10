import { describe, expect, it, vi } from 'vitest'
import { loadConfig } from './config'
import { classifyTideDirection, TideService } from './tide'

const NOW = Date.parse('2026-09-09T19:00:00.000Z')
const LOCATION = {
  latitude: 37.771954,
  longitude: -122.30026,
  provenance: {
    kind: 'current' as const,
    label: 'Current device location',
    capturedAt: '2026-09-09T18:59:00.000Z',
  },
}

const predictionPoints = [
  { t: '2026-09-09 07:00', v: '0.8' },
  { t: '2026-09-09 12:00', v: '1.2' },
  { t: '2026-09-09 18:54', v: '2.0' },
  { t: '2026-09-09 19:00', v: '2.1' },
  { t: '2026-09-09 19:06', v: '2.2' },
  { t: '2026-09-09 22:00', v: '5.4' },
  { t: '2026-09-10 06:54', v: '1.0' },
  { t: '2026-09-10 07:00', v: '0.9' },
  { t: '2026-09-10 07:06', v: '0.8' },
]

const tideTurns = [
  { t: '2026-09-09 16:00', v: '0.4', type: 'L' },
  { t: '2026-09-09 22:00', v: '5.4', type: 'H' },
  { t: '2026-09-10 04:15', v: '0.6', type: 'L' },
]

const observations = [
  { t: '2026-09-09 18:48', v: '1.98', s: '0.02', f: '0,0,0,0', q: 'v' },
  { t: '2026-09-09 18:54', v: '2.03', s: '0.02', f: '0,0,0,0', q: 'v' },
  { t: '2026-09-09 19:00', v: '2.10', s: '0.02', f: '0,0,0,0', q: 'v' },
]

const observationMetadata = {
  id: '9414290',
  name: 'San Francisco',
  lat: '37.8063',
  lon: '-122.4659',
}

function tideConfig() {
  return loadConfig({ TIDE_STATION_ID: '9414290', TIDE_STATION_LABEL: 'Alameda' })
}

function providerFetch({
  failObservations = false,
  malformedPredictions = false,
  points = predictionPoints,
  turns = tideTurns,
  observed = observations,
  stationId = '9414290',
  stationName = 'San Francisco',
}: {
  failObservations?: boolean
  malformedPredictions?: boolean
  points?: typeof predictionPoints
  turns?: typeof tideTurns
  observed?: typeof observations
  stationId?: string
  stationName?: string
} = {}) {
  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    expect(url.origin).toBe('https://api.tidesandcurrents.noaa.gov')
    expect(url.pathname).toBe('/api/prod/datagetter')
    expect(url.searchParams.get('station')).toBe(stationId)
    expect(url.searchParams.get('datum')).toBe('MLLW')
    expect(url.searchParams.get('units')).toBe('english')
    expect(url.searchParams.get('time_zone')).toBe('gmt')
    expect(url.searchParams.get('format')).toBe('json')
    expect(init?.redirect).toBe('error')

    const product = url.searchParams.get('product')
    if (product === 'water_level') {
      if (failObservations) return new Response('unavailable', { status: 503 })
      return Response.json({
        metadata: { ...observationMetadata, id: stationId, name: stationName },
        data: observed,
      })
    }
    if (url.searchParams.get('interval') === 'hilo') {
      return Response.json({ predictions: turns })
    }
    return malformedPredictions
      ? Response.json({ predictions: [{ t: 'not-a-time', v: '2.0' }] })
      : Response.json({ predictions: points })
  })
}

describe('tide normalization and fallback', () => {
  it.each([
    [0.049, 'near-slack'],
    [-0.049, 'near-slack'],
    [0.05, 'rising'],
    [-0.05, 'falling'],
  ] as const)('classifies a %s-foot change as %s', (change, direction) => {
    expect(classifyTideDirection(change)).toBe(direction)
  })

  it('returns the latest eligible observation, next turn, and private-label-only provenance', async () => {
    const fetchMock = providerFetch()
    const service = new TideService(tideConfig(), fetchMock as typeof fetch, () => NOW)

    const envelope = await service.load(LOCATION, 'America/Los_Angeles')

    expect(envelope.data.current).toEqual({
      at: '2026-09-09T19:00:00.000Z',
      heightFeet: 2.1,
      basis: 'observed',
      direction: 'rising',
    })
    expect(envelope.data.nextTurn).toEqual({
      kind: 'high',
      at: '2026-09-09T22:00:00.000Z',
      heightFeet: 5.4,
    })
    expect(envelope.data.station).toEqual({ label: 'Alameda', datum: 'MLLW', units: 'feet' })
    expect(envelope.meta).toMatchObject({
      freshness: 'fresh',
      sourceUpdatedAt: '2026-09-09T19:00:00.000Z',
      issues: [],
    })
    expect(JSON.stringify(envelope)).not.toContain('9414290')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.every(([input]) => !String(input).includes('stations.json'))).toBe(
      true,
    )
  })

  it('keeps predictions usable and labels the result partial when observations fail', async () => {
    const service = new TideService(
      tideConfig(),
      providerFetch({ failObservations: true }) as typeof fetch,
      () => NOW,
    )

    const envelope = await service.load(LOCATION, 'America/Los_Angeles')

    expect(envelope.data.current).toMatchObject({
      at: '2026-09-09T19:00:00.000Z',
      heightFeet: 2.1,
      basis: 'predicted',
      direction: 'rising',
    })
    expect(envelope.meta.freshness).toBe('partial')
    expect(envelope.meta.sourceUpdatedAt).toBeNull()
    expect(envelope.meta.issues).toEqual([
      expect.objectContaining({
        code: 'upstream-unavailable',
        message: expect.stringContaining('showing the predicted tide'),
        retryable: true,
      }),
    ])
  })

  it('retains a validated last-good envelope when a forced prediction refresh is malformed', async () => {
    let malformed = false
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      return providerFetch({ malformedPredictions: malformed })(input, init)
    })
    const service = new TideService(tideConfig(), fetchMock as typeof fetch, () => NOW)
    const original = await service.load(LOCATION, 'America/Los_Angeles')

    malformed = true
    const fallback = await service.load(LOCATION, 'America/Los_Angeles', true)

    expect(fallback.data).toEqual(original.data)
    expect(fallback.meta.freshness).toBe('stale')
    expect(fallback.meta.issues[0]).toMatchObject({
      code: 'upstream-unavailable',
      retryable: true,
    })
  })

  it('fails closed on chronologically invalid prediction data without a last-good value', async () => {
    const service = new TideService(
      tideConfig(),
      providerFetch({ points: [predictionPoints[1], predictionPoints[0]] }) as typeof fetch,
      () => NOW,
    )

    await expect(service.load(LOCATION, 'America/Los_Angeles')).rejects.toMatchObject({
      code: 'upstream-unavailable',
    })
  })

  it('fails closed on an impossible provider calendar date', async () => {
    const service = new TideService(
      tideConfig(),
      providerFetch({
        points: [{ ...predictionPoints[0], t: '2026-02-30 07:00' }, ...predictionPoints.slice(1)],
      }) as typeof fetch,
      () => NOW,
    )

    await expect(service.load(LOCATION, 'America/Los_Angeles')).rejects.toMatchObject({
      code: 'upstream-unavailable',
    })
  })

  it('includes rollover predictions needed for a next turn after local midnight', async () => {
    const lateNow = Date.parse('2026-09-10T06:50:00.000Z')
    const lateTurns = [
      { t: '2026-09-10 03:30', v: '4.8', type: 'H' as const },
      { t: '2026-09-10 07:05', v: '0.5', type: 'L' as const },
    ]
    const service = new TideService(
      tideConfig(),
      providerFetch({ turns: lateTurns, observed: [] }) as typeof fetch,
      () => lateNow,
    )

    const envelope = await service.load(LOCATION, 'America/Los_Angeles')

    expect(envelope.data.nextTurn.at).toBe('2026-09-10T07:05:00.000Z')
    expect(envelope.data.predictions.at(-1)?.at).toBe('2026-09-10T07:06:00.000Z')
    expect(envelope.data.turns.at(-1)?.at).toBe('2026-09-10T07:05:00.000Z')
  })

  it('downsamples the visual series while retaining current brackets, turns, and boundaries', async () => {
    const firstAt = Date.parse('2026-09-09T07:00:00.000Z')
    const points = Array.from({ length: 241 }, (_, index) => {
      const at = new Date(firstAt + index * 6 * 60_000).toISOString()
      return {
        t: at.slice(0, 16).replace('T', ' '),
        v: String(2 + Math.sin(index / 20)),
      }
    })
    const turns = [
      { t: '2026-09-09 16:03', v: '0.4', type: 'L' as const },
      { t: '2026-09-09 22:03', v: '5.4', type: 'H' as const },
      { t: '2026-09-10 04:15', v: '0.6', type: 'L' as const },
    ]
    const service = new TideService(
      tideConfig(),
      providerFetch({ points, turns }) as typeof fetch,
      () => NOW + 2 * 60_000,
    )

    const envelope = await service.load(LOCATION, 'America/Los_Angeles')
    const returnedTimes = envelope.data.predictions.map((point) => point.at)

    expect(envelope.data.predictions.length).toBeLessThan(60)
    expect(returnedTimes[0]).toBe('2026-09-09T07:00:00.000Z')
    expect(returnedTimes).toContain('2026-09-09T19:00:00.000Z')
    expect(returnedTimes).toContain('2026-09-09T19:06:00.000Z')
    expect(returnedTimes).toContain('2026-09-09T22:03:00.000Z')
    expect(returnedTimes.at(-1)).toBe('2026-09-10T06:54:00.000Z')
  })

  it('rejects an invalid browser time zone before contacting NOAA', async () => {
    const fetchMock = providerFetch()
    const service = new TideService(tideConfig(), fetchMock as typeof fetch, () => NOW)

    await expect(service.load(LOCATION, 'Not/A_Time_Zone')).rejects.toMatchObject({
      code: 'invalid-configuration',
      statusCode: 400,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('selects and caches the nearest eligible NOAA station without sending location', async () => {
    const productFetch = providerFetch({ stationId: '9414750', stationName: 'Alameda' })
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/stations.json')) {
        expect(url.searchParams.get('type')).toBe('waterlevels')
        expect(url.search).not.toContain('37.771954')
        expect(url.search).not.toContain('-122.30026')
        return Response.json({
          stations: [
            {
              id: 'not valid',
              name: 'Ignored',
              lat: 37.77,
              lng: -122.3,
              tidal: true,
              observedst: true,
            },
            {
              id: '9414290',
              name: 'San Francisco',
              lat: 37.806305,
              lng: -122.46589,
              tidal: true,
              observedst: true,
            },
            {
              id: '9414748',
              name: 'Invalid\nname',
              lat: 37.771954,
              lng: -122.30026,
              tidal: true,
              observedst: true,
            },
            {
              id: '9414749',
              name: 'Closer but non-tidal',
              lat: 37.771954,
              lng: -122.30026,
              tidal: false,
              observedst: true,
            },
            {
              id: '9414751',
              name: 'Closer but not observed',
              lat: 37.771954,
              lng: -122.30026,
              tidal: true,
              observedst: false,
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
      return productFetch(input, init)
    })
    const service = new TideService(loadConfig({}), fetchMock as typeof fetch, () => NOW)

    const first = await service.load(LOCATION, 'America/Los_Angeles')
    const second = await service.load(LOCATION, 'America/Los_Angeles')

    expect(first.data.station.label).toBe('Alameda')
    expect(first.meta.location).toEqual(LOCATION.provenance)
    expect(second.data).toEqual(first.data)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(JSON.stringify(first)).not.toContain('9414750')
  })

  it.each([
    ['unavailable', () => new Response('unavailable', { status: 503 })],
    ['malformed', () => Response.json({ stations: 'not-an-array' })],
    ['empty', () => Response.json({ stations: [] })],
    [
      'without eligible stations',
      () =>
        Response.json({
          stations: [
            {
              id: '9414750',
              name: 'Alameda',
              lat: 37.771954,
              lng: -122.30026,
              tidal: true,
              observedst: false,
            },
          ],
        }),
    ],
    [
      'over the entry limit',
      () =>
        Response.json({
          stations: Array.from({ length: 1_001 }, (_, index) => ({
            id: String(index),
            name: `Station ${index}`,
            lat: 37,
            lng: -122,
            tidal: true,
            observedst: true,
          })),
        }),
    ],
    [
      'over the declared body limit',
      () =>
        new Response('{}', {
          headers: { 'content-length': String(1024 * 1024 + 1) },
        }),
    ],
    ['over the streamed body limit', () => new Response('x'.repeat(1024 * 1024 + 1))],
  ])('fails tide safely when the station catalog is %s', async (_case, catalogResponse) => {
    const fetchMock = vi.fn(async () => catalogResponse())
    const service = new TideService(loadConfig({}), fetchMock as typeof fetch, () => NOW)

    await expect(service.load(LOCATION, 'America/Los_Angeles')).rejects.toMatchObject({
      code: 'upstream-unavailable',
      statusCode: 502,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/stations.json?type=waterlevels')
  })

  it('times out a station catalog body that stops making progress', async () => {
    const stalledBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"stations":['))
      },
    })
    const fetchMock = vi.fn(async () => new Response(stalledBody))
    const service = new TideService(
      loadConfig({ UPSTREAM_TIMEOUT_MS: '500' }),
      fetchMock as typeof fetch,
      () => NOW,
    )

    await expect(service.load(LOCATION, 'America/Los_Angeles')).rejects.toMatchObject({
      code: 'timeout',
      statusCode: 504,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
