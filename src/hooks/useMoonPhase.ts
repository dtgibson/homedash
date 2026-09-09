import { useCallback, useEffect, useRef, useState } from 'react'
import { deriveMoonPhase, nextMoonPhaseBoundaryAt, type MoonPhaseLabel } from '../lib/moonPhase'

function nextLocalMidnightAt(atMs: number): number | null {
  if (!Number.isFinite(atMs)) return null
  const midnight = new Date(atMs)
  if (!Number.isFinite(midnight.getTime())) return null
  midnight.setHours(24, 0, 0, 0)
  const boundaryAt = midnight.getTime()
  return Number.isFinite(boundaryAt) && boundaryAt > atMs ? boundaryAt : null
}

function nextEvaluationAt(atMs: number): number | null {
  const candidates = [nextMoonPhaseBoundaryAt(atMs), nextLocalMidnightAt(atMs)].filter(
    (candidate): candidate is number => candidate != null && candidate > atMs,
  )
  return candidates.length ? Math.min(...candidates) : null
}

export function useMoonPhase() {
  const [label, setLabel] = useState<MoonPhaseLabel | null>(() => deriveMoonPhase(Date.now()))
  const timeoutRef = useRef<number | null>(null)
  const activeRef = useRef(false)
  const scheduleRef = useRef<(atMs: number) => void>(() => undefined)

  const clearScheduledEvaluation = useCallback(() => {
    if (timeoutRef.current == null) return
    window.clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }, [])

  const reevaluate = useCallback(() => {
    clearScheduledEvaluation()
    if (!activeRef.current) return

    const atMs = Date.now()
    const nextLabel = deriveMoonPhase(atMs)
    setLabel((current) => (current === nextLabel ? current : nextLabel))
    scheduleRef.current(atMs)
  }, [clearScheduledEvaluation])

  useEffect(() => {
    activeRef.current = true

    const schedule = (atMs: number) => {
      if (document.visibilityState === 'hidden') return
      const boundaryAt = nextEvaluationAt(atMs)
      if (boundaryAt == null) return
      timeoutRef.current = window.setTimeout(reevaluate, boundaryAt - atMs)
    }
    scheduleRef.current = schedule

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearScheduledEvaluation()
        return
      }
      reevaluate()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    schedule(Date.now())

    return () => {
      activeRef.current = false
      scheduleRef.current = () => undefined
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearScheduledEvaluation()
    }
  }, [clearScheduledEvaluation, reevaluate])

  return { label, reevaluate }
}
