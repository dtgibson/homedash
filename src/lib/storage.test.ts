import { beforeEach, describe, expect, it } from 'vitest'
import { readEligibleLocation, readPreferences } from './storage'

beforeEach(() => localStorage.clear())

describe('browser-owned preferences and location', () => {
  it('falls back to Dawn and System for missing or malformed preferences', () => {
    expect(readPreferences()).toMatchObject({ mode: 'dawn', appearance: 'system' })
    localStorage.setItem('homedash.preferences.v1', '{broken')
    expect(readPreferences()).toMatchObject({ mode: 'dawn', appearance: 'system' })
    localStorage.setItem(
      'homedash.preferences.v1',
      JSON.stringify({ schemaVersion: 1, mode: 'quiet', appearance: 'purple' }),
    )
    expect(readPreferences()).toMatchObject({ mode: 'dawn', appearance: 'system' })
  })

  it('only offers a last-known location captured within seven days', () => {
    localStorage.setItem(
      'homedash.location.v1',
      JSON.stringify({
        schemaVersion: 1,
        latitude: 37,
        longitude: -122,
        capturedAt: '2026-09-01T00:00:00.000Z',
      }),
    )
    expect(readEligibleLocation(Date.parse('2026-09-07T23:59:00.000Z'))).not.toBeNull()
    expect(readEligibleLocation(Date.parse('2026-09-08T00:01:00.000Z'))).toBeNull()
  })
})
