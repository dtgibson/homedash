import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { WidgetState } from '../hooks/useDashboardData'
import { tidePath } from '../lib/tideGeometry'
import type { TideEnvelope, WeatherEnvelope } from '../shared/contracts'
import { CoastalDay, DenseTide } from './Tide'

const generatedAt = '2026-09-09T15:00:00.000Z'

const tideEnvelope: TideEnvelope = {
  schemaVersion: 1,
  data: {
    station: { label: 'Alameda', datum: 'MLLW', units: 'feet' },
    current: {
      at: '2026-09-09T14:54:00.000Z',
      heightFeet: 2.1,
      basis: 'observed',
      direction: 'rising',
    },
    nextTurn: { kind: 'high', at: '2026-09-09T17:42:00.000Z', heightFeet: 5.4 },
    predictions: [
      { at: '2026-09-09T07:00:00.000Z', heightFeet: 0.7 },
      { at: '2026-09-09T14:54:00.000Z', heightFeet: 2.1 },
      { at: '2026-09-09T17:42:00.000Z', heightFeet: 5.4 },
      { at: '2026-09-10T06:54:00.000Z', heightFeet: 1.0 },
    ],
    turns: [
      { kind: 'low', at: '2026-09-09T09:00:00.000Z', heightFeet: 0.7 },
      { kind: 'high', at: '2026-09-09T17:42:00.000Z', heightFeet: 5.4 },
    ],
  },
  meta: {
    generatedAt,
    sourceUpdatedAt: '2026-09-09T14:54:00.000Z',
    freshness: 'fresh',
    staleAfterMs: 900_000,
    issues: [],
  },
}

const weatherEnvelope: WeatherEnvelope = {
  schemaVersion: 1,
  data: {
    temperatureUnit: 'fahrenheit',
    timeZone: 'America/Los_Angeles',
    currentTemperature: 58,
    apparentTemperature: 58,
    condition: 'Clear',
    high: 69,
    low: 52,
    precipitationProbability: 4,
    windSpeed: 7,
    sunrise: '2026-09-09T13:47:00.000Z',
    sunset: '2026-09-10T02:23:00.000Z',
    daylightMinutes: 756,
    nextDaylightEvent: { kind: 'sunset', at: '2026-09-10T02:23:00.000Z' },
    hourly: [],
  },
  meta: {
    generatedAt,
    sourceUpdatedAt: generatedAt,
    freshness: 'fresh',
    staleAfterMs: 900_000,
    issues: [],
  },
}

function ready(envelope = tideEnvelope): WidgetState<TideEnvelope> {
  return { status: 'ready', data: envelope, message: null, refreshStatus: 'idle' }
}

describe('shared tide presentation', () => {
  it('draws bounded full and compact traces from the same normalized points', () => {
    const full = tidePath(tideEnvelope.data.predictions)
    const compact = tidePath(tideEnvelope.data.predictions, 124, 2, 20)

    expect(full).toMatch(/^M12\.00/)
    expect(full).toContain('L508.00')
    expect(compact).toMatch(/^M1\.00/)
    expect(compact).toContain('L123.00')
    expect(full).not.toContain('NaN')
  })

  it('keeps authoritative observed tide text beside daylight and moon context', () => {
    const { container } = render(
      <CoastalDay
        weather={weatherEnvelope}
        tide={ready()}
        moonPhase="Waxing gibbous"
        onRetry={vi.fn()}
      />,
    )

    const summary = container.querySelector('.coastal-graphic')
    expect(summary).toHaveAccessibleName(
      /Current tide 2\.1 ft observed, rising\. Next high 5\.4 ft at/i,
    )
    expect(container.querySelector('.tide-facts-full')).toHaveTextContent(
      /2\.1 ft observed · rising/i,
    )
    expect(container.querySelector('.tide-facts-full')).toHaveTextContent(/High 5\.4 ft/i)
    expect(container.querySelector('.tide-facts-full')).toHaveTextContent(/Alameda · MLLW/i)
    expect(screen.getByText('Waxing gibbous')).toBeInTheDocument()
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).not.toHaveLength(0)
    expect(container.querySelectorAll('.solar-rule')).toHaveLength(2)
    expect(container.querySelector('.tide-current-point')).toBeInTheDocument()
    expect(container.querySelector('.tide-turn-point')).toBeInTheDocument()
  })

  it('shows identical predicted provenance and next-turn facts in Dense', () => {
    const partial: TideEnvelope = {
      ...tideEnvelope,
      data: {
        ...tideEnvelope.data,
        current: { ...tideEnvelope.data.current, basis: 'predicted', direction: 'near-slack' },
      },
      meta: {
        ...tideEnvelope.meta,
        sourceUpdatedAt: null,
        freshness: 'partial',
        issues: [
          {
            code: 'upstream-unavailable',
            message: 'The latest observation is unavailable; showing the predicted tide.',
            retryable: true,
          },
        ],
      },
    }
    const { container } = render(<DenseTide state={ready(partial)} onRetry={vi.fn()} />)

    expect(container.querySelector('.dense-tide-line')).toHaveAccessibleName(
      /Tide 2\.1 ft predicted, near slack\. Next high 5\.4 ft/i,
    )
    expect(container.querySelector('.dense-tide-line')).toHaveTextContent(/2\.1 ft predicted/i)
    expect(container.querySelector('.dense-tide-line')).toHaveTextContent(/near slack/i)
    expect(container.querySelector('.dense-tide-line')).toHaveTextContent(/Alameda · MLLW/i)
    expect(container.querySelector('.dense-tide-trace')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('status', { name: /Partially updated/i })).toBeInTheDocument()
  })

  it('isolates an unavailable tide while retaining solar and moon content and a tide-only retry', () => {
    const retry = vi.fn()
    render(
      <CoastalDay
        weather={weatherEnvelope}
        tide={{ status: 'error', data: null, message: 'No station is configured.' }}
        moonPhase="Waxing gibbous"
        onRetry={retry}
      />,
    )

    expect(screen.getByText(/Sunrise/i)).toBeInTheDocument()
    expect(screen.getByText('Waxing gibbous')).toBeInTheDocument()
    expect(screen.getByText('Tide is unavailable.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})
