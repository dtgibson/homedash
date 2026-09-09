export type MoonPhaseLabel =
  | 'New moon'
  | 'Waxing crescent'
  | 'First quarter'
  | 'Waxing gibbous'
  | 'Full moon'
  | 'Waning gibbous'
  | 'Last quarter'
  | 'Waning crescent'

const REFERENCE_NEW_MOON_MS = 947_182_440_000
const SYNODIC_MONTH_MS = 2_551_442_876.8992
const PHASE_BOUNDARIES = [1, 3, 5, 7, 9, 11, 13, 15].map((sixteenths) => sixteenths / 16)

export function classifyMoonPhasePosition(position: number): MoonPhaseLabel | null {
  if (!Number.isFinite(position) || position < 0 || position >= 1) return null
  if (position < 1 / 16 || position >= 15 / 16) return 'New moon'
  if (position < 3 / 16) return 'Waxing crescent'
  if (position < 5 / 16) return 'First quarter'
  if (position < 7 / 16) return 'Waxing gibbous'
  if (position < 9 / 16) return 'Full moon'
  if (position < 11 / 16) return 'Waning gibbous'
  if (position < 13 / 16) return 'Last quarter'
  return 'Waning crescent'
}

export function deriveMoonPhase(atMs: number): MoonPhaseLabel | null {
  if (!Number.isFinite(atMs)) return null
  const cycles = (atMs - REFERENCE_NEW_MOON_MS) / SYNODIC_MONTH_MS
  if (!Number.isFinite(cycles)) return null
  const position = cycles - Math.floor(cycles)
  return Number.isFinite(position) ? classifyMoonPhasePosition(position) : null
}

export function nextMoonPhaseBoundaryAt(atMs: number): number | null {
  if (!Number.isFinite(atMs)) return null
  const cycles = (atMs - REFERENCE_NEW_MOON_MS) / SYNODIC_MONTH_MS
  if (!Number.isFinite(cycles)) return null

  const cycle = Math.floor(cycles)
  const position = cycles - cycle
  if (!Number.isFinite(position)) return null

  const nextPosition = PHASE_BOUNDARIES.find((boundary) => boundary > position)
  const boundaryCycles = nextPosition == null ? cycle + 1 + 1 / 16 : cycle + nextPosition
  const boundaryAt = Math.ceil(REFERENCE_NEW_MOON_MS + boundaryCycles * SYNODIC_MONTH_MS)

  return Number.isFinite(boundaryAt) && boundaryAt > atMs ? boundaryAt : null
}
