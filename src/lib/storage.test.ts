import { beforeEach, describe, expect, it } from 'vitest'
import { readEligibleLocation, readPreferences, savePreferences } from './storage'

beforeEach(() => localStorage.clear())

describe('browser-owned preferences and location', () => {
  it('falls back to Dawn and System for missing or malformed preferences', () => {
    expect(readPreferences()).toMatchObject({
      mode: 'dawn',
      appearance: 'system',
      targetSort: 'distance',
    })
    localStorage.setItem('homedash.preferences.v1', '{broken')
    expect(readPreferences()).toMatchObject({
      mode: 'dawn',
      appearance: 'system',
      targetSort: 'distance',
    })
    localStorage.setItem(
      'homedash.preferences.v1',
      JSON.stringify({ schemaVersion: 1, mode: 'quiet', appearance: 'purple' }),
    )
    expect(readPreferences()).toMatchObject({
      mode: 'dawn',
      appearance: 'system',
      targetSort: 'distance',
    })
    localStorage.setItem(
      'homedash.preferences.v1',
      JSON.stringify({ schemaVersion: 1, mode: 'dense', appearance: 'dark', targetSort: 'newest' }),
    )
    expect(readPreferences()).toEqual({
      schemaVersion: 1,
      mode: 'dense',
      appearance: 'dark',
      targetSort: 'distance',
    })
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

  it('reports whether a preference was retained without preventing the current selection', () => {
    const preference = {
      schemaVersion: 1 as const,
      mode: 'dense' as const,
      appearance: 'dark' as const,
      targetSort: 'recent' as const,
    }
    expect(savePreferences(preference)).toBe(true)
    expect(readPreferences()).toEqual(preference)

    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage disabled', 'SecurityError')
    }
    try {
      expect(savePreferences(preference)).toBe(false)
    } finally {
      Storage.prototype.setItem = original
    }
  })
})
