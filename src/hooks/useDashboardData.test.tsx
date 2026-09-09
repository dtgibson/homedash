import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDashboardData } from './useDashboardData'

const capturedAt = '2026-09-09T12:00:00.000Z'

function envelopes({
  temperature = 58,
  bookmark = 'GitHub',
  species = 94,
  remaining = 68,
  locationKind = 'current' as 'current' | 'last-known' | 'home',
} = {}) {
  const meta = {
    generatedAt: capturedAt,
    sourceUpdatedAt: capturedAt,
    freshness: 'fresh' as const,
    staleAfterMs: 60_000,
    issues: [],
  }
  return {
    weather: {
      schemaVersion: 1 as const,
      data: {
        temperatureUnit: 'fahrenheit' as const,
        timeZone: 'America/Los_Angeles',
        currentTemperature: temperature,
        apparentTemperature: temperature,
        condition: 'Clear sky',
        high: 72,
        low: 51,
        precipitationProbability: 4,
        windSpeed: 8,
        sunrise: '2026-09-09T13:42:00.000Z',
        sunset: '2026-09-10T02:28:00.000Z',
        daylightMinutes: 766,
        nextDaylightEvent: { kind: 'sunrise' as const, at: '2026-09-09T13:42:00.000Z' },
        hourly: [],
      },
      meta: {
        ...meta,
        location: {
          kind: locationKind,
          label: locationKind === 'home' ? 'Home' : 'San Francisco',
          capturedAt: locationKind === 'home' ? null : capturedAt,
        },
      },
    },
    bookmarks: {
      schemaVersion: 1 as const,
      data: {
        bookmarks: [
          {
            id: bookmark.toLowerCase(),
            group: 'Daily',
            name: bookmark,
            url: 'https://example.com',
            order: 0,
          },
        ],
        invalidEntryCount: 0,
      },
      meta,
    },
    ebird: {
      schemaVersion: 1 as const,
      data: {
        radiusKm: 50,
        windowDays: 14,
        targets: { lifer: [], photo: [], audio: [] },
        targetAvailability: { lifer: true, photo: true, audio: true },
        month: {
          label: 'September',
          throughDay: 9,
          currentCount: species,
          previousCount: 87,
          difference: species - 87,
        },
        nearbyUpdatedAt: capturedAt,
        profileUpdatedAt: capturedAt,
      },
      meta: {
        ...meta,
        location: {
          kind: locationKind,
          label: locationKind === 'home' ? 'Home' : 'San Francisco',
          capturedAt: locationKind === 'home' ? null : capturedAt,
        },
      },
    },
    llmdash: {
      schemaVersion: 1 as const,
      data: {
        generatedAt: capturedAt,
        providers: [
          {
            id: 'claude' as const,
            label: 'Claude Code',
            fiveHour: { remainingPct: remaining, resetsAt: capturedAt, capturedAt },
            weekly: { remainingPct: remaining, resetsAt: capturedAt, capturedAt },
            diagnostic: null,
          },
          {
            id: 'codex' as const,
            label: 'Codex',
            fiveHour: { remainingPct: remaining, resetsAt: capturedAt, capturedAt },
            weekly: { remainingPct: remaining, resetsAt: capturedAt, capturedAt },
            diagnostic: null,
          },
        ],
      },
      meta,
    },
  }
}

const paths = {
  '/api/weather': 'weather',
  '/api/bookmarks': 'bookmarks',
  '/api/ebird/summary': 'ebird',
  '/api/llmdash/summary': 'llmdash',
} as const

function pathFor(input: RequestInfo | URL) {
  return new URL(typeof input === 'string' ? input : input.toString(), 'http://homedash.test')
    .pathname
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function seedSnapshots(values: ReturnType<typeof envelopes>) {
  localStorage.setItem('homedash.cache.weather.v1', JSON.stringify(values.weather))
  localStorage.setItem('homedash.cache.bookmarks.v1', JSON.stringify(values.bookmarks))
  localStorage.setItem('homedash.cache.ebird.v1', JSON.stringify(values.ebird))
  localStorage.setItem('homedash.cache.llmdash.v1', JSON.stringify(values.llmdash))
}

beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (success: PositionCallback) =>
        success({
          coords: { latitude: 37.77, longitude: -122.42 },
          timestamp: Date.parse(capturedAt),
        } as GeolocationPosition),
    },
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('cached dashboard refresh lifecycle', () => {
  it('hydrates all four validated snapshots, settles independently, and preserves a failed source', async () => {
    const saved = envelopes({
      temperature: 41,
      bookmark: 'Saved bookmark',
      species: 12,
      remaining: 9,
      locationKind: 'home',
    })
    const fresh = envelopes()
    seedSnapshots(saved)

    const pending = new Map<string, ReturnType<typeof deferred<Response>>>()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const request = deferred<Response>()
        pending.set(pathFor(input), request)
        return request.promise
      }),
    )

    const { result } = renderHook(() => useDashboardData())

    expect(result.current.visibleSourceCount).toBe(4)
    expect(result.current.refreshProgress).toBe(0)
    expect(result.current.data.weather).toMatchObject({
      status: 'ready',
      refreshStatus: 'refreshing',
      data: {
        data: { currentTemperature: 41 },
        meta: { freshness: 'stale', location: { kind: 'home', label: 'Home' } },
      },
    })
    expect(result.current.data.bookmarks).toMatchObject({
      status: 'ready',
      data: { data: { bookmarks: [{ name: 'Saved bookmark' }] } },
    })
    expect(result.current.data.ebird).toMatchObject({
      status: 'ready',
      data: { data: { month: { currentCount: 12 } } },
    })
    expect(result.current.data.llmdash.status).toBe('ready')
    if (result.current.data.llmdash.status === 'ready') {
      expect(result.current.data.llmdash.data.data.providers[0].fiveHour?.remainingPct).toBe(9)
    }

    await waitFor(() => expect(pending.size).toBe(4))

    await act(async () => {
      pending.get('/api/bookmarks')?.resolve(response(fresh.bookmarks))
    })
    await waitFor(() =>
      expect(result.current.data.bookmarks).toMatchObject({
        status: 'ready',
        refreshStatus: 'idle',
        data: { data: { bookmarks: [{ name: 'GitHub' }] } },
      }),
    )
    expect(result.current.data.weather).toMatchObject({
      status: 'ready',
      refreshStatus: 'refreshing',
      data: { data: { currentTemperature: 41 } },
    })

    await act(async () => {
      pending.get('/api/llmdash/summary')?.reject(new Error('llmdash timed out'))
    })
    await waitFor(() =>
      expect(result.current.data.llmdash).toMatchObject({
        status: 'ready',
        refreshStatus: 'failed',
        message: 'llmdash timed out',
      }),
    )
    if (result.current.data.llmdash.status === 'ready') {
      expect(result.current.data.llmdash.data.data.providers[0].fiveHour?.remainingPct).toBe(9)
    }

    await act(async () => {
      pending.get('/api/weather')?.resolve(response(fresh.weather))
      pending.get('/api/ebird/summary')?.resolve(response(fresh.ebird))
    })
    await waitFor(() => expect(result.current.isRefreshing).toBe(false))
    expect(result.current.data.weather).toMatchObject({
      status: 'ready',
      refreshStatus: 'idle',
      data: {
        data: { currentTemperature: 58 },
        meta: { location: { kind: 'current', label: 'San Francisco' } },
      },
    })
  })

  it('keeps missing, malformed, and version-incompatible snapshots on the first-visit path', () => {
    const saved = envelopes()
    localStorage.setItem('homedash.cache.weather.v1', '{broken')
    localStorage.setItem(
      'homedash.cache.bookmarks.v1',
      JSON.stringify({ ...saved.bookmarks, schemaVersion: 2 }),
    )
    localStorage.setItem('homedash.cache.ebird.v1', JSON.stringify(saved.ebird))
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    )

    const { result } = renderHook(() => useDashboardData())

    expect(result.current.data.weather.status).toBe('loading')
    expect(result.current.data.bookmarks.status).toBe('loading')
    expect(result.current.data.ebird).toMatchObject({
      status: 'ready',
      refreshStatus: 'refreshing',
    })
    expect(result.current.data.llmdash.status).toBe('loading')
  })

  it('keeps every last-good value visible during a manual refresh batch', async () => {
    const original = envelopes({
      temperature: 52,
      bookmark: 'Original',
      species: 44,
      remaining: 33,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const key = paths[pathFor(input) as keyof typeof paths]
        return Promise.resolve(response(original[key]))
      }),
    )
    const { result } = renderHook(() => useDashboardData())
    await waitFor(() => expect(result.current.isRefreshing).toBe(false))

    const pending = new Map<string, ReturnType<typeof deferred<Response>>>()
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const request = deferred<Response>()
      pending.set(pathFor(input), request)
      return request.promise
    })

    let refresh!: Promise<void>
    act(() => {
      refresh = result.current.refreshAll()
    })
    await waitFor(() => expect(pending.size).toBe(4))

    expect(result.current.refreshProgress).toBe(0)
    expect(result.current.data.weather).toMatchObject({
      status: 'ready',
      refreshStatus: 'refreshing',
      data: { data: { currentTemperature: 52 } },
    })
    expect(result.current.data.bookmarks).toMatchObject({
      status: 'ready',
      refreshStatus: 'refreshing',
      data: { data: { bookmarks: [{ name: 'Original' }] } },
    })

    const updated = envelopes({ temperature: 61, bookmark: 'Updated', species: 45, remaining: 31 })
    await act(async () => {
      pending.get('/api/weather')?.resolve(response(updated.weather))
      pending.get('/api/ebird/summary')?.resolve(response(updated.ebird))
      pending.get('/api/llmdash/summary')?.resolve(response(updated.llmdash))
      pending
        .get('/api/bookmarks')
        ?.resolve(response({ message: 'Bookmark configuration is unavailable.' }, 503))
      await refresh
    })

    expect(result.current.isRefreshing).toBe(false)
    expect(result.current.data.weather).toMatchObject({
      status: 'ready',
      data: { data: { currentTemperature: 61 } },
    })
    expect(result.current.data.bookmarks).toMatchObject({
      status: 'ready',
      refreshStatus: 'failed',
      data: { data: { bookmarks: [{ name: 'Original' }] } },
    })
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.headers).toMatchObject({
      'x-homedash-refresh': '1',
    })
  })
})
