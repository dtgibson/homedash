import { describe, expect, it, vi } from 'vitest'
import { loadConfig } from './config'
import { classifyTideDirection, TideService } from './tide'

const NOW = Date.parse('2026-09-09T19:00:00.000Z')

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
}: {
  failObservations?: boolean
  malformedPredictions?: boolean
  points?: typeof predictionPoints
  turns?: typeof tideTurns
  observed?: typeof observations
} = {}) {
  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    expect(url.origin).toBe('https://api.tidesandcurrents.noaa.gov')
    expect(url.pathname).toBe('/api/prod/datagetter')
    expect(url.searchParams.get('station')).toBe('9414290')
    expect(url.searchParams.get('datum')).toBe('MLLW')
    expect(url.searchParams.get('units')).toBe('english')
    expect(url.searchParams.get('time_zone')).toBe('gmt')
    expect(url.searchParams.get('format')).toBe('json')
    expect(init?.redirect).toBe('error')

    const product = url.searchParams.get('product')
    if (product === 'water_level') {
      if (failObservations) return new Response('unavailable', { status: 503 })
      return Response.json({ metadata: observationMetadata, data: observed })
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
    const service = new TideService(tideConfig(), providerFetch() as typeof fetch, () => NOW)

    const envelope = await service.load('America/Los_Angeles')

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
  })

  it('keeps predictions usable and labels the result partial when observations fail', async () => {
    const service = new TideService(
      tideConfig(),
      providerFetch({ failObservations: true }) as typeof fetch,
      () => NOW,
    )

    const envelope = await service.load('America/Los_Angeles')

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
    const original = await service.load('America/Los_Angeles')

    malformed = true
    const fallback = await service.load('America/Los_Angeles', true)

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

    await expect(service.load('America/Los_Angeles')).rejects.toMatchObject({
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

    await expect(service.load('America/Los_Angeles')).rejects.toMatchObject({
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

    const envelope = await service.load('America/Los_Angeles')

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

    const envelope = await service.load('America/Los_Angeles')
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

    await expect(service.load('Not/A_Time_Zone')).rejects.toMatchObject({
      code: 'invalid-configuration',
      statusCode: 400,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
