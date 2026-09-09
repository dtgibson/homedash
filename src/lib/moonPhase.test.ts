import { describe, expect, it } from 'vitest'
import {
  classifyMoonPhasePosition,
  deriveMoonPhase,
  nextMoonPhaseBoundaryAt,
  type MoonPhaseLabel,
} from './moonPhase'

const REFERENCE_NEW_MOON_MS = 947_182_440_000
const SYNODIC_MONTH_MS = 2_551_442_876.8992

const knownDates: Array<[string, MoonPhaseLabel]> = [
  ['2024-04-08T18:21:00Z', 'New moon'],
  ['2024-04-12T12:00:00Z', 'Waxing crescent'],
  ['2024-04-15T19:13:00Z', 'First quarter'],
  ['2024-04-19T12:00:00Z', 'Waxing gibbous'],
  ['2024-04-23T23:49:00Z', 'Full moon'],
  ['2024-04-27T12:00:00Z', 'Waning gibbous'],
  ['2024-05-01T11:27:00Z', 'Last quarter'],
  ['2024-05-05T00:00:00Z', 'Waning crescent'],
]

const boundaries: Array<[number, MoonPhaseLabel, MoonPhaseLabel]> = [
  [1 / 16, 'New moon', 'Waxing crescent'],
  [3 / 16, 'Waxing crescent', 'First quarter'],
  [5 / 16, 'First quarter', 'Waxing gibbous'],
  [7 / 16, 'Waxing gibbous', 'Full moon'],
  [9 / 16, 'Full moon', 'Waning gibbous'],
  [11 / 16, 'Waning gibbous', 'Last quarter'],
  [13 / 16, 'Last quarter', 'Waning crescent'],
  [15 / 16, 'Waning crescent', 'New moon'],
]

describe('moon phase classification', () => {
  it.each(knownDates)('classifies the approved fixture %s as %s', (instant, label) => {
    expect(deriveMoonPhase(Date.parse(instant))).toBe(label)
  })

  it.each(boundaries)(
    'makes the boundary at %d lower-inclusive',
    (boundary, previousLabel, nextLabel) => {
      const epsilon = Number.EPSILON
      expect(classifyMoonPhasePosition(boundary - epsilon)).toBe(previousLabel)
      expect(classifyMoonPhasePosition(boundary)).toBe(nextLabel)
      expect(classifyMoonPhasePosition(boundary + epsilon)).toBe(nextLabel)
    },
  )

  it('keeps both sides of cycle wrap in the New moon band', () => {
    expect(classifyMoonPhasePosition(0)).toBe('New moon')
    expect(classifyMoonPhasePosition(Number.EPSILON)).toBe('New moon')
    expect(classifyMoonPhasePosition(1 - Number.EPSILON)).toBe('New moon')
  })

  it('normalizes pre-epoch dates with floor and rejects invalid inputs', () => {
    expect(deriveMoonPhase(REFERENCE_NEW_MOON_MS - SYNODIC_MONTH_MS / 32)).toBe('New moon')
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(deriveMoonPhase(value)).toBeNull()
      expect(nextMoonPhaseBoundaryAt(value)).toBeNull()
      expect(classifyMoonPhasePosition(value)).toBeNull()
    }
    expect(classifyMoonPhasePosition(-Number.EPSILON)).toBeNull()
    expect(classifyMoonPhasePosition(1)).toBeNull()
  })

  it('selects a strictly future qualitative boundary, including after the wrap band', () => {
    const firstBoundary = Math.ceil(REFERENCE_NEW_MOON_MS + SYNODIC_MONTH_MS / 16)
    expect(nextMoonPhaseBoundaryAt(REFERENCE_NEW_MOON_MS)).toBe(firstBoundary)
    expect(nextMoonPhaseBoundaryAt(firstBoundary)).toBeGreaterThan(firstBoundary)

    const afterLastBoundary = Math.ceil(REFERENCE_NEW_MOON_MS + (15 / 16) * SYNODIC_MONTH_MS)
    const nextCycleFirstBoundary = nextMoonPhaseBoundaryAt(afterLastBoundary)
    expect(nextCycleFirstBoundary).not.toBeNull()
    expect(nextCycleFirstBoundary!).toBeGreaterThan(afterLastBoundary)
    expect(deriveMoonPhase(nextCycleFirstBoundary!)).toBe('Waxing crescent')
  })
})
