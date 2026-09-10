import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { dashboard, moonPhase } = vi.hoisted(() => {
  const now = '2026-09-08T05:00:00.000Z'
  const meta = {
    generatedAt: now,
    sourceUpdatedAt: now,
    freshness: 'fresh' as 'fresh' | 'partial' | 'stale',
    staleAfterMs: 60_000,
    issues: [],
  }
  return {
    moonPhase: {
      label: 'Waxing gibbous' as const,
      reevaluate: vi.fn(),
    },
    dashboard: {
      data: {
        weather: {
          status: 'ready' as const,
          message: null as string | null,
          refreshStatus: 'idle' as 'idle' | 'refreshing' | 'failed',
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
          message: null as string | null,
          refreshStatus: 'idle' as 'idle' | 'refreshing' | 'failed',
          data: {
            schemaVersion: 1 as const,
            data: {
              radiusKm: 16,
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
              targetOrders: {
                distance: {
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
                recent: {
                  lifer: [
                    {
                      speciesCode: 'towwar',
                      commonName: "Townsend's Warbler",
                      observedAt: '2026-09-08T05:30:00.000Z',
                      locality: 'Oak grove',
                      distanceKm: 7.1,
                    },
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
          message: null as string | null,
          refreshStatus: 'idle' as 'idle' | 'refreshing' | 'failed',
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
          message: null as string | null,
          refreshStatus: 'idle' as 'idle' | 'refreshing' | 'failed',
          data: {
            schemaVersion: 1 as const,
            data: {
              sections: ['Daily'],
              bookmarks: [
                {
                  id: '0123456789abcdef',
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
        tide: {
          status: 'ready' as const,
          message: null as string | null,
          refreshStatus: 'idle' as 'idle' | 'refreshing' | 'failed',
          data: {
            schemaVersion: 1 as const,
            data: {
              station: { label: 'Alameda', datum: 'MLLW' as const, units: 'feet' as const },
              current: {
                at: now,
                heightFeet: 2.1,
                basis: 'observed' as const,
                direction: 'rising' as const,
              },
              nextTurn: {
                kind: 'high' as const,
                at: '2026-09-08T10:42:00.000Z',
                heightFeet: 5.4,
              },
              predictions: [
                { at: '2026-09-08T00:00:00.000Z', heightFeet: 0.5 },
                { at: now, heightFeet: 2.1 },
                { at: '2026-09-08T10:42:00.000Z', heightFeet: 5.4 },
                { at: '2026-09-09T00:00:00.000Z', heightFeet: 1.2 },
              ],
              turns: [
                { kind: 'low' as const, at: '2026-09-08T03:00:00.000Z', heightFeet: 0.5 },
                { kind: 'high' as const, at: '2026-09-08T10:42:00.000Z', heightFeet: 5.4 },
              ],
            },
            meta,
          },
        },
      },
      selector: { kind: 'current' as const, latitude: 37, longitude: -122, capturedAt: now },
      isRefreshing: false,
      refreshProgress: 5,
      visibleSourceCount: 5,
      isLocating: false,
      locationMessage: 'Using this device’s current location.',
      retryLocation: vi.fn(async () => undefined),
      retryWidget: vi.fn(async () => undefined),
      refreshAll: vi.fn(async () => undefined),
      acceptSavedBookmarks: vi.fn(() => true),
    },
  }
})

vi.mock('./hooks/useDashboardData', () => ({ useDashboardData: () => dashboard }))
vi.mock('./hooks/useMoonPhase', () => ({ useMoonPhase: () => moonPhase }))

import App from './App'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  document.documentElement.dataset.appearance = ''
  dashboard.isRefreshing = false
  dashboard.refreshProgress = 5
  dashboard.visibleSourceCount = 5
  moonPhase.label = 'Waxing gibbous'
  Object.values(dashboard.data).forEach((widget) => {
    widget.refreshStatus = 'idle'
    widget.message = null
    widget.data.meta.freshness = 'fresh'
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            revision: `sha256:${'a'.repeat(64)}`,
            document: {
              schemaVersion: 1,
              sections: [
                {
                  name: 'Daily',
                  bookmarks: [{ name: 'GitHub', url: 'https://github.com' }],
                },
              ],
            },
            display: dashboard.data.bookmarks.data,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    ),
  )
})

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Settings' }))
  await screen.findByRole('dialog', { name: 'Settings' })
}

async function closeSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull())
}

describe('one store with two renderers', () => {
  it('removes the dashboard from assistive technology while Settings is modal', async () => {
    const user = userEvent.setup()
    render(<App />)
    const main = screen.getByRole('main')
    const dashboardSurface = main.closest('.shell')

    await openSettings(user)

    expect(screen.getByRole('dialog', { name: 'Settings' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.queryByRole('main')).toBeNull()
    expect(screen.getByRole('main', { hidden: true })).toBe(main)
    expect(dashboardSurface).toHaveAttribute('aria-hidden', 'true')
    expect(dashboardSurface).toHaveAttribute('inert')

    await closeSettings(user)

    expect(screen.getByRole('main')).toBe(main)
    expect(dashboardSurface).not.toHaveAttribute('aria-hidden')
    expect(dashboardSurface).not.toHaveAttribute('inert')
  })

  it('passes one authoritative moon phase through renderer and appearance changes', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText('Moon')).toBeVisible()
    expect(screen.getByText('Waxing gibbous')).toBeVisible()

    await openSettings(user)
    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    await user.click(screen.getByRole('radio', { name: 'Dense' }))
    await closeSettings(user)
    expect(screen.getByText('Waxing gibbous')).toBeVisible()
    expect(screen.getByText('Waxing gibbous')).toBeVisible()
    expect(screen.getByText(/moon ·/i)).toBeVisible()
    expect(screen.getAllByText('Waxing gibbous')).toHaveLength(1)
  })

  it('switches presentation without losing values and persists the mode per browser', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('heading', { name: 'The day ahead' })).toBeVisible()
    expect(screen.getAllByText('57°')[0]).toBeVisible()
    expect(screen.getByText('Ruff')).toBeVisible()

    await openSettings(user)
    await user.click(screen.getByRole('radio', { name: 'Dense' }))
    await closeSettings(user)
    expect(screen.getByRole('heading', { name: 'Weather' })).toBeVisible()
    expect(screen.getAllByText('57°')[0]).toBeVisible()
    expect(screen.getByText('Ruff')).toBeVisible()
    expect(JSON.parse(localStorage.getItem('homedash.preferences.v1') ?? '{}').mode).toBe('dense')
  })

  it('keeps appearance independent and applies a saved explicit palette', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openSettings(user)
    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    await closeSettings(user)
    await waitFor(() => expect(document.documentElement.dataset.appearance).toBe('dark'))
    expect(JSON.parse(localStorage.getItem('homedash.preferences.v1') ?? '{}').appearance).toBe(
      'dark',
    )
  })

  it('keeps a browser preference active and announces when storage refuses it', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openSettings(user)
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage disabled', 'SecurityError')
    }
    try {
      await user.click(screen.getByRole('radio', { name: 'Dense' }))
    } finally {
      Storage.prototype.setItem = original
    }

    expect(screen.queryByRole('heading', { name: 'Weather' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Weather', hidden: true })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Dense view · system appearance applied, but this browser could not retain it.',
      ),
    ).toBeVisible()
    await closeSettings(user)
    expect(screen.getByRole('heading', { name: 'Weather' })).toBeVisible()
  })

  it('keeps one ephemeral Kagi form across renderers and focuses it only on mount', async () => {
    const user = userEvent.setup()
    render(<App />)
    const query = screen.getByRole('searchbox', { name: 'Kagi' })
    const form = screen.getByRole('search', { name: 'Kagi web search' })

    expect(query).toHaveFocus()
    expect(form).toHaveAttribute('action', 'https://kagi.com/search')
    expect(form).toHaveAttribute('method', 'get')
    expect(query).toHaveAttribute('name', 'q')
    expect(screen.getByRole('button', { name: 'Search with Kagi' })).toHaveAttribute(
      'type',
      'submit',
    )

    await user.type(query, '  sandhill crane  ')
    await openSettings(user)
    await user.click(screen.getByRole('radio', { name: 'Dense' }))
    await closeSettings(user)
    expect(screen.getAllByRole('search')).toHaveLength(1)
    expect(query).toHaveValue('  sandhill crane  ')
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus()

    form.addEventListener('submit', (event) => event.preventDefault(), { once: true })
    fireEvent.submit(form)
    expect(query).toHaveValue('sandhill crane')
    expect(query).not.toHaveFocus()
  })

  it('prevents and announces a blank Kagi submission', async () => {
    render(<App />)
    const query = screen.getByRole('searchbox', { name: 'Kagi' })
    fireEvent.change(query, { target: { value: '   ' } })
    const event = new Event('submit', { bubbles: true, cancelable: true })

    expect(fireEvent(screen.getByRole('search'), event)).toBe(false)
    expect(query).toHaveValue('')
    expect(screen.getByText('Enter a search before going to Kagi.')).toBeVisible()
  })

  it('exposes equivalent fixed launch links and miles in Dawn and Dense', async () => {
    const user = userEvent.setup()
    render(<App />)

    const expectLaunches = () => {
      expect(
        screen.getByRole('link', { name: 'Open My eBird for September progress' }),
      ).toHaveAttribute('href', '/launch/ebird/my-ebird')
      expect(screen.getByRole('link', { name: 'Open eBird map for Ruff' })).toHaveAttribute(
        'href',
        '/launch/ebird/map/ruff',
      )
      expect(screen.getByRole('link', { name: 'Open llmdash dashboard' })).toHaveAttribute(
        'href',
        '/launch/llmdash',
      )
      expect(screen.getByText('1.5 mi')).toBeVisible()
      expect(screen.getByText(/within 10 mi/i)).toBeVisible()
    }

    expectLaunches()
    await openSettings(user)
    await user.click(screen.getByRole('radio', { name: 'Dense' }))
    await closeSettings(user)
    expectLaunches()
    expect(screen.queryByText(/\bkm\b/i)).not.toBeInTheDocument()
  })

  it('switches one persisted target order across categories and renderers without a request', async () => {
    const user = userEvent.setup()
    render(<App />)

    const nearest = screen.getByRole('radio', { name: 'Nearest' })
    const recent = screen.getByRole('radio', { name: 'Recent' })
    expect(nearest).toBeChecked()
    expect(screen.getByText('Ruff')).toBeVisible()
    expect(screen.queryByText("Townsend's Warbler")).not.toBeInTheDocument()

    await user.click(recent)

    expect(recent).toBeChecked()
    expect(recent).toHaveFocus()
    expect(screen.getByText("Townsend's Warbler")).toBeVisible()
    expect(screen.getByText('Recent targets selected.')).toBeVisible()
    expect(JSON.parse(localStorage.getItem('homedash.preferences.v1') ?? '{}')).toMatchObject({
      mode: 'dawn',
      appearance: 'system',
      targetSort: 'recent',
    })
    expect(globalThis.fetch).not.toHaveBeenCalled()

    await user.click(screen.getByRole('radio', { name: /Lifers/ }))
    await openSettings(user)
    await user.click(screen.getByRole('radio', { name: 'Dense' }))
    await closeSettings(user)

    expect(screen.getByRole('radio', { name: 'Recent' })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Lifers/ })).toBeChecked()
    expect(screen.getByText("Townsend's Warbler")).toBeVisible()
  })

  it('keeps a target order active and announces when storage refuses it', async () => {
    const user = userEvent.setup()
    render(<App />)
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage disabled', 'SecurityError')
    }
    try {
      await user.click(screen.getByRole('radio', { name: 'Recent' }))
    } finally {
      Storage.prototype.setItem = original
    }

    expect(screen.getByRole('radio', { name: 'Recent' })).toBeChecked()
    expect(screen.getByText("Townsend's Warbler")).toBeVisible()
    expect(
      screen.getByText('Recent targets selected. This browser could not retain the choice.'),
    ).toBeVisible()
  })

  it('shows the same source freshness and aggregate progress in Dawn and Dense', async () => {
    const user = userEvent.setup()
    dashboard.isRefreshing = true
    dashboard.refreshProgress = 2
    dashboard.data.ebird.refreshStatus = 'refreshing'
    dashboard.data.bookmarks.refreshStatus = 'refreshing'

    render(<App />)

    expect(
      screen.getByRole('button', {
        name: 'Refreshing 2 of 5 sources; saved readings remain visible',
      }),
    ).toHaveTextContent('Refreshing 2/5')
    expect(screen.getAllByRole('status', { name: /Refreshing/ })).toHaveLength(2)

    await openSettings(user)
    await user.click(screen.getByRole('radio', { name: 'Dense' }))
    await closeSettings(user)
    expect(screen.getAllByRole('status', { name: /Refreshing/ })).toHaveLength(2)
  })

  it('keeps a failed saved reading visible with a source-specific retry', async () => {
    const user = userEvent.setup()
    dashboard.data.bookmarks.refreshStatus = 'failed'
    dashboard.data.bookmarks.message = 'Bookmark refresh timed out.'
    dashboard.data.bookmarks.data.meta.freshness = 'stale'

    render(<App />)

    expect(screen.getByRole('link', { name: 'GitHub' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Try bookmarks again' }))
    expect(dashboard.retryWidget).toHaveBeenCalledWith('bookmarks')
    await waitFor(() => expect(moonPhase.reevaluate).toHaveBeenCalledTimes(1))
  })

  it('re-evaluates lunar context when a weather retry settles', async () => {
    const user = userEvent.setup()
    dashboard.data.weather.refreshStatus = 'failed'
    dashboard.data.weather.message = 'Weather refresh timed out.'
    dashboard.data.weather.data.meta.freshness = 'stale'

    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Try weather again' }))

    expect(dashboard.retryWidget).toHaveBeenCalledWith('weather')
    await waitFor(() => expect(moonPhase.reevaluate).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Waxing gibbous')).toBeVisible()
  })

  it('re-evaluates lunar context after global and location refreshes settle', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByRole('button', {
        name: 'Refresh weather, tide, bookmarks, eBird, and llmdash data',
      }),
    )
    await waitFor(() => expect(dashboard.refreshAll).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(moonPhase.reevaluate).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'Update device location' }))
    await waitFor(() => expect(dashboard.retryLocation).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(moonPhase.reevaluate).toHaveBeenCalledTimes(2))
  })
})
