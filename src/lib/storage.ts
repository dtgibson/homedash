import type { z } from 'zod'
import {
  DEFAULT_PREFERENCES,
  preferencesSchema,
  storedLocationSchema,
  type DevicePreferences,
  type StoredLocation,
} from '../shared/contracts'

export const PREFERENCES_KEY = 'homedash.preferences.v1'
export const LOCATION_KEY = 'homedash.location.v1'

export function readPreferences(): DevicePreferences {
  try {
    const parsed = preferencesSchema.safeParse(
      JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? 'null'),
    )
    return parsed.success ? parsed.data : DEFAULT_PREFERENCES
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function savePreferences(value: DevicePreferences) {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(value))
    return true
  } catch {
    // Preferences still work for this visit if storage is unavailable.
    return false
  }
}

export function readEligibleLocation(now = Date.now()): StoredLocation | null {
  try {
    const parsed = storedLocationSchema.safeParse(
      JSON.parse(localStorage.getItem(LOCATION_KEY) ?? 'null'),
    )
    if (!parsed.success || now - Date.parse(parsed.data.capturedAt) > 7 * 86_400_000) return null
    return parsed.data
  } catch {
    return null
  }
}

export function saveLocation(value: StoredLocation) {
  try {
    localStorage.setItem(LOCATION_KEY, JSON.stringify(value))
  } catch {
    // Location simply loses its last-known fallback when storage is unavailable.
  }
}

export function readSnapshot<T>(key: string, schema: z.ZodType<T>): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(localStorage.getItem(key) ?? 'null'))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function saveSnapshot(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Live data remains usable when the browser refuses local storage.
  }
}
