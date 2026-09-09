import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { WeatherEnvelope } from '../shared/contracts'
import type { MoonPhaseLabel } from '../lib/moonPhase'
import { DawnDaylight, DenseDaylight } from './Weather'

const labels: MoonPhaseLabel[] = [
  'New moon',
  'Waxing crescent',
  'First quarter',
  'Waxing gibbous',
  'Full moon',
  'Waning gibbous',
  'Last quarter',
  'Waning crescent',
]

const weather: WeatherEnvelope = {
  schemaVersion: 1,
  data: {
    temperatureUnit: 'fahrenheit',
    timeZone: 'America/Los_Angeles',
    currentTemperature: 58,
    apparentTemperature: 57,
    condition: 'Low clouds, then clear',
    high: 72,
    low: 56,
    precipitationProbability: 8,
    windSpeed: 8,
    sunrise: '2026-09-09T13:47:00.000Z',
    sunset: '2026-09-10T02:33:00.000Z',
    daylightMinutes: 766,
    nextDaylightEvent: { kind: 'sunset', at: '2026-09-10T02:33:00.000Z' },
    hourly: [],
  },
  meta: {
    generatedAt: '2026-09-09T15:00:00.000Z',
    sourceUpdatedAt: '2026-09-09T15:00:00.000Z',
    freshness: 'fresh',
    staleAfterMs: 60_000,
    issues: [],
    location: { kind: 'current', label: 'San Francisco', capturedAt: '2026-09-09T15:00:00.000Z' },
  },
}

describe('moon phase daylight presentation', () => {
  it.each(labels)('uses the same canonical %s text in both renderers', (label) => {
    const { rerender } = render(<DawnDaylight envelope={weather} moonPhase={label} />)
    expect(screen.getByText(label, { exact: true })).toBeVisible()

    rerender(<DenseDaylight envelope={weather} moonPhase={label} />)
    expect(screen.getByText(label, { exact: true })).toBeVisible()
  })

  it('renders authoritative text after Dawn solar context without changing its accessible name', () => {
    const { container } = render(<DawnDaylight envelope={weather} moonPhase="Waxing gibbous" />)

    const solarContext = screen.getByLabelText(/Sunrise .*, sunset .*, 12 hours 46 minutes/)
    const phase = screen.getByText('Waxing gibbous')
    expect(solarContext.compareDocumentPosition(phase) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(screen.getByText('Moon')).toBeVisible()
    expect(solarContext).not.toHaveAccessibleName(/moon/i)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders Dense solar and lunar meaning in one existing daylight line', () => {
    const { container } = render(<DenseDaylight envelope={weather} moonPhase="Waning crescent" />)

    const line = container.querySelector('.dense-daylight-line')
    expect(line).toHaveTextContent(/sunrise .* · sunset .* · daylight 12h 46m/i)
    expect(line).toHaveTextContent('moon · Waning crescent')
    expect(container.querySelectorAll('.dense-daylight-line')).toHaveLength(1)
  })

  it('keeps the phase independent of weather availability in both renderers', () => {
    const { rerender } = render(<DawnDaylight envelope={null} moonPhase="Full moon" />)

    expect(screen.getByText('Full moon')).toBeVisible()
    expect(screen.queryByLabelText(/Sunrise/)).not.toBeInTheDocument()

    rerender(<DenseDaylight envelope={null} moonPhase="Full moon" />)
    expect(screen.getByText('Full moon')).toBeVisible()
    expect(screen.queryByText(/sunrise/i)).not.toBeInTheDocument()
  })

  it('omits every lunar fragment for a null result without suppressing daylight', () => {
    const { rerender } = render(<DawnDaylight envelope={weather} moonPhase={null} />)

    expect(screen.queryByText(/moon/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Sunrise/)).toBeVisible()

    rerender(<DenseDaylight envelope={weather} moonPhase={null} />)
    expect(screen.queryByText(/moon/i)).not.toBeInTheDocument()
    expect(screen.getByText(/daylight 12h 46m/i)).toBeVisible()
  })
})
