import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as moonPhase from '../lib/moonPhase'
import { useMoonPhase } from './useMoonPhase'

const REFERENCE_NEW_MOON_MS = 947_182_440_000
const SYNODIC_MONTH_MS = 2_551_442_876.8992

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  setVisibility('visible')
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  setVisibility('visible')
})

describe('useMoonPhase lifecycle', () => {
  it('evaluates immediately and updates at the next qualitative boundary', () => {
    const boundaryAt = Math.ceil(REFERENCE_NEW_MOON_MS + SYNODIC_MONTH_MS / 16)
    vi.setSystemTime(boundaryAt - 2)
    const { result } = renderHook(() => useMoonPhase())

    expect(result.current.label).toBe('New moon')
    expect(vi.getTimerCount()).toBe(1)

    act(() => vi.advanceTimersByTime(2))
    expect(result.current.label).toBe('Waxing crescent')
    expect(vi.getTimerCount()).toBe(1)
  })

  it('re-evaluates at browser-local midnight without a seconds or minutes poll', () => {
    vi.setSystemTime(new Date(2024, 3, 12, 23, 59, 59, 990))
    const derive = vi.spyOn(moonPhase, 'deriveMoonPhase')
    const { result } = renderHook(() => useMoonPhase())
    const initial = result.current.label
    const callsAfterMount = derive.mock.calls.length

    act(() => vi.advanceTimersByTime(9))
    expect(derive).toHaveBeenCalledTimes(callsAfterMount)
    expect(result.current.label).toBe(initial)

    act(() => vi.advanceTimersByTime(1))
    expect(derive).toHaveBeenCalledTimes(callsAfterMount + 1)
    expect(result.current.label).toBe(initial)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('clears background work while hidden and corrects the phase on visibility wake', () => {
    const boundaryAt = Math.ceil(REFERENCE_NEW_MOON_MS + SYNODIC_MONTH_MS / 16)
    vi.setSystemTime(boundaryAt - 2)
    const { result } = renderHook(() => useMoonPhase())

    act(() => setVisibility('hidden'))
    expect(vi.getTimerCount()).toBe(0)
    act(() => vi.setSystemTime(boundaryAt + 1))
    expect(result.current.label).toBe('New moon')

    act(() => setVisibility('visible'))
    expect(result.current.label).toBe('Waxing crescent')
    expect(vi.getTimerCount()).toBe(1)
  })

  it('offers a stable refresh-settlement callback and avoids unchanged state churn', () => {
    vi.setSystemTime(Date.parse('2024-04-12T12:00:00Z'))
    let renders = 0
    const { result } = renderHook(() => {
      renders += 1
      return useMoonPhase()
    })
    const callback = result.current.reevaluate
    const initialRenders = renders

    act(() => result.current.reevaluate())
    expect(result.current.reevaluate).toBe(callback)
    expect(renders).toBe(initialRenders)

    act(() => vi.setSystemTime(Date.parse('2024-04-15T19:13:00Z')))
    act(() => result.current.reevaluate())
    expect(result.current.label).toBe('First quarter')
    expect(renders).toBe(initialRenders + 1)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('omits an invalid result, runs no timer, and can recover on a later wake', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(Number.NaN)
    const { result } = renderHook(() => useMoonPhase())

    expect(result.current.label).toBeNull()
    expect(vi.getTimerCount()).toBe(0)

    now.mockReturnValue(Date.parse('2024-04-23T23:49:00Z'))
    act(() => setVisibility('hidden'))
    act(() => setVisibility('visible'))
    expect(result.current.label).toBe('Full moon')
    expect(vi.getTimerCount()).toBe(1)
  })

  it('removes its visibility listener and scheduled callback on unmount', () => {
    vi.setSystemTime(Date.parse('2024-04-12T12:00:00Z'))
    const removeEventListener = vi.spyOn(document, 'removeEventListener')
    const { unmount } = renderHook(() => useMoonPhase())

    expect(vi.getTimerCount()).toBe(1)
    unmount()

    expect(vi.getTimerCount()).toBe(0)
    expect(removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })
})
