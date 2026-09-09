import { useEffect, useState } from 'react'
import type { DevicePreferences } from '../shared/contracts'
import { readPreferences, savePreferences } from '../lib/storage'

export function usePreferences() {
  const [preferences, setPreferencesState] = useState(readPreferences)
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const resolved =
      preferences.appearance === 'system' ? (systemDark ? 'dark' : 'light') : preferences.appearance
    document.documentElement.dataset.appearance = resolved
    document.documentElement.dataset.preference = preferences.appearance
  }, [preferences.appearance, systemDark])

  const setPreferences = (next: DevicePreferences) => {
    setPreferencesState(next)
    return savePreferences(next)
  }

  return { preferences, setPreferences }
}
