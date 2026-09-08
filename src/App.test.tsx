import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { dashboard } = vi.hoisted(() => {
  const now = '2026-09-08T05:00:00.000Z'
  const meta = {
    generatedAt: now,
    sourceUpdatedAt: now,
    freshness: 'fresh' as const,
    staleAfterMs: 60_000,
    issues: [],
  }
  return {
    dashboard: {
      data: {
        weather: {
          status: 'ready' as const,
          message: null,
          data: {
            schemaVersion: 1 as const,
            data: {
              temperatureUnit: 'fahrenheit' as const,
              timeZone: 'America/Los_Angeles',
              currentTemperature: 57,
              apparentTemperature: 56,
              condition: 'Clear sky',
              high: 72,
              low: 51,
              precipitationProbability: 4,
              windSpeed: 8,
              sunrise: '2026-09-08T13:42:00.000Z',
              sunset: '2026-09-09T02:28:00.000Z',
              daylightMinutes: 766,
              nextDaylightEvent: { kind: 'sunrise' as const, at: '2026-09-08T13:42:00.000Z' },
              hourly: [
                {
                  at: now,
                  temperature: 57,
                  condition: 'Clear sky',
                  precipitationProbability: 4,
                },
              ],
            },
            meta: {
              ...meta,
              location: {
                kind: 'current' as const,
                label: 'Current device location',
                capturedAt: now,
              },
            },
          },
        },
        ebird: {
          status: 'ready' as const,
          message: null,
          data: {
            schemaVersion: 1 as const,
            data: {
              radiusKm: 50,
              windowDays: 14,
              targets: {
                lifer: [
                  {
                    speciesCode: 'ruff',
                    commonName: 'Ruff',
                    observedAt: now,
                    locality: 'Bay shore',
                    distanceKm: 2.4,
                  },
                ],
                photo: [],
                audio: [],
              },
              targetAvailability: { lifer: true, photo: true, audio: true },
              month: {
                label: 'September',
                throughDay: 8,
                currentCount: 94,
                previousCount: 87,
                difference: 7,
              },
              nearbyUpdatedAt: now,
              profileUpdatedAt: now,
            },
            meta,
          },
        },
        llmdash: {
          status: 'ready' as const,
          message: null,
          data: {
            schemaVersion: 1 as const,
            data: {
              generatedAt: now,
              providers: [
                {
                  id: 'claude' as const,
                  label: 'Claude Code',
                  fiveHour: { remainingPct: 68, resetsAt: now, capturedAt: now },
                  weekly: { remainingPct: 41, resetsAt: now, capturedAt: now },
                  diagnostic: null,
                },
                {
                  id: 'codex' as const,
                  label: 'Codex',
                  fiveHour: { remainingPct: 22, resetsAt: now, capturedAt: now },
                  weekly: { remainingPct: 63, resetsAt: now, capturedAt: now },
                  diagnostic: null,
                },
              ],
            },
            meta,
          },
        },
        bookmarks: {
          status: 'ready' as const,
          message: null,
          data: {
            schemaVersion: 1 as const,
            data: {
              bookmarks: [
                {
                  id: 'github',
                  group: 'Daily',
                  name: 'GitHub',
                  url: 'https://github.com',
                  order: 0,
                },
              ],
              invalidEntryCount: 0,
            },
            meta,
          },
        },
      },
      selector: { kind: 'current' as const, latitude: 37, longitude: -122, capturedAt: now },
      isRefreshing: false,
      isLocating: false,
      locationMessage: 'Using this device’s current location.',
      retryLocation: vi.fn(async () => undefined),
      refreshAll: vi.fn(async () => undefined),
    },
  }
})

vi.mock('./hooks/useDashboardData', () => ({ useDashboardData: () => dashboard }))

import App from './App'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.dataset.appearance = ''
})

describe('one store with two renderers', () => {
  it('switches presentation without losing values and persists the mode per browser', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('heading', { name: 'The day ahead' })).toBeVisible()
    expect(screen.getAllByText('57°')[0]).toBeVisible()
    expect(screen.getByText('Ruff')).toBeVisible()

    await user.click(screen.getByRole('radio', { name: 'Use Dense display mode' }))
    expect(screen.getByRole('heading', { name: 'Weather' })).toBeVisible()
    expect(screen.getAllByText('57°')[0]).toBeVisible()
    expect(screen.getByText('Ruff')).toBeVisible()
    expect(JSON.parse(localStorage.getItem('homedash.preferences.v1') ?? '{}').mode).toBe('dense')
  })

  it('keeps appearance independent and applies a saved explicit palette', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    await waitFor(() => expect(document.documentElement.dataset.appearance).toBe('dark'))
    expect(JSON.parse(localStorage.getItem('homedash.preferences.v1') ?? '{}').appearance).toBe(
      'dark',
    )
  })
})
