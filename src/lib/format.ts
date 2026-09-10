export function formatTemperature(value: number) {
  return `${Math.round(value)}°`
}

export function formatPercent(value: number | null) {
  return value == null ? '—' : `${Math.round(value)}%`
}

export function formatTime(value: string | null, options: Intl.DateTimeFormatOptions = {}) {
  if (!value) return 'unavailable'
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  }).format(new Date(value))
}

export function formatDateTime(value: string | null) {
  if (!value) return 'never'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatAge(value: string | null, now = Date.now()) {
  if (!value) return 'unknown age'
  const elapsed = Math.max(0, now - Date.parse(value))
  if (elapsed < 60_000) return 'just now'
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`
  return `${Math.floor(elapsed / 86_400_000)}d ago`
}

const MILES_PER_KILOMETER = 0.621371

export function kilometersToMiles(value: number) {
  return value * MILES_PER_KILOMETER
}

export function formatMiles(value: number) {
  const miles = kilometersToMiles(value)
  return `${miles < 10 - 1e-9 ? miles.toFixed(1) : Math.round(miles)} mi`
}

export function formatRadiusMiles(value: number) {
  return `${Math.round(kilometersToMiles(value))} mi`
}

export function formatDistance(value: number | null) {
  return value == null ? 'distance unknown' : formatMiles(value)
}

export function formatObserved(value: string) {
  const date = new Date(value)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  return sameDay
    ? `today · ${formatTime(value)}`
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

export function signed(value: number) {
  return value > 0 ? `+${value}` : String(value)
}
