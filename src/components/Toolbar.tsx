import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { useEffect, useRef, type FormEvent } from 'react'
import type { DevicePreferences } from '../shared/contracts'

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6.1 9a7 7 0 0 1 11.8-2L20 12M4 12l2.1 5a7 7 0 0 0 11.8-2" />
    </svg>
  )
}

interface ToolbarProps {
  preferences: DevicePreferences
  onPreferences: (preferences: DevicePreferences) => void
  onLocation: () => void
  onRefresh: () => void
  onStatus: (message: string) => void
  locating: boolean
  refreshing: boolean
}

export function Toolbar({
  preferences,
  onPreferences,
  onLocation,
  onRefresh,
  onStatus,
  locating,
  refreshing,
}: ToolbarProps) {
  const queryRef = useRef<HTMLInputElement>(null)
  const hasFocusedSearch = useRef(false)

  useEffect(() => {
    if (hasFocusedSearch.current) return
    hasFocusedSearch.current = true
    queryRef.current?.focus({ preventScroll: true })
  }, [])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    const query = queryRef.current
    if (!query) return
    const trimmed = query.value.trim()
    if (!trimmed) {
      event.preventDefault()
      query.value = ''
      onStatus('Enter a search before going to Kagi.')
      return
    }
    query.value = trimmed
  }

  return (
    <header className="app-toolbar" aria-label="Dashboard preferences">
      <div className="wordmark">
        <span className="wordmark-mark" aria-hidden="true" />
        homedash
      </div>
      <form
        className="kagi-form"
        action="https://kagi.com/search"
        method="get"
        role="search"
        aria-label="Kagi web search"
        onSubmit={submitSearch}
      >
        <label className="kagi-label" htmlFor="kagi-query">
          Kagi
        </label>
        <input
          ref={queryRef}
          id="kagi-query"
          name="q"
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Search the web"
          aria-describedby="kagi-hint"
        />
        <span id="kagi-hint" hidden>
          Enter a non-empty query and press Enter, or use the search button.
        </span>
        <button type="submit" aria-label="Search with Kagi">
          <span aria-hidden="true">→</span>
        </button>
      </form>
      <div className="toolbar-controls">
        <ToggleGroup.Root
          className="control-set"
          type="single"
          value={preferences.mode}
          aria-label="Display mode"
          onValueChange={(mode) => {
            if (mode === 'dawn' || mode === 'dense') onPreferences({ ...preferences, mode })
          }}
        >
          <ToggleGroup.Item value="dawn" aria-label="Use Dawn display mode">
            Dawn
          </ToggleGroup.Item>
          <ToggleGroup.Item value="dense" aria-label="Use Dense display mode">
            Dense
          </ToggleGroup.Item>
        </ToggleGroup.Root>
        <ToggleGroup.Root
          className="control-set"
          type="single"
          value={preferences.appearance}
          aria-label="Appearance"
          onValueChange={(appearance) => {
            if (appearance === 'system' || appearance === 'light' || appearance === 'dark') {
              onPreferences({ ...preferences, appearance })
            }
          }}
        >
          <ToggleGroup.Item value="system">System</ToggleGroup.Item>
          <ToggleGroup.Item value="light">Light</ToggleGroup.Item>
          <ToggleGroup.Item value="dark">Dark</ToggleGroup.Item>
        </ToggleGroup.Root>
        <button
          className={`icon-button ${locating ? 'is-busy' : ''}`}
          type="button"
          onClick={onLocation}
          disabled={locating}
          aria-label="Update device location"
        >
          <LocationIcon />
          <span>{locating ? 'Locating' : 'Location'}</span>
        </button>
        <button
          className={`icon-button ${refreshing ? 'is-busy' : ''}`}
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh weather, bookmarks, eBird, and llmdash data"
        >
          <RefreshIcon />
          <span>{refreshing ? 'Refreshing' : 'Refresh'}</span>
        </button>
      </div>
    </header>
  )
}
