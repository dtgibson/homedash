import { describe, expect, it } from 'vitest'
import { formatDistance, formatMiles, kilometersToMiles } from './format'

describe('eBird mile presentation', () => {
  it('uses the approved statute-mile conversion without changing source kilometers', () => {
    const sourceKilometers = 2.4
    expect(kilometersToMiles(sourceKilometers)).toBeCloseTo(1.4912904)
    expect(sourceKilometers).toBe(2.4)
    expect(formatDistance(sourceKilometers)).toBe('1.5 mi')
  })

  it('keeps one decimal below ten miles and rounds values from ten miles upward', () => {
    expect(formatMiles(0)).toBe('0.0 mi')
    expect(formatMiles(15)).toBe('9.3 mi')
    expect(formatMiles(10 / 0.621371)).toBe('10 mi')
    expect(formatMiles(27)).toBe('17 mi')
    expect(formatMiles(50)).toBe('31 mi')
  })

  it('keeps an unknown target distance explicit', () => {
    expect(formatDistance(null)).toBe('distance unknown')
  })
})
