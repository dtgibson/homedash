import { useCallback, useEffect, useRef, useState } from 'react'
import type { z } from 'zod'
import {
  bookmarksEnvelopeSchema,
  ebirdEnvelopeSchema,
  llmdashEnvelopeSchema,
  tideEnvelopeSchema,
  weatherEnvelopeSchema,
  storedBookmarksEnvelopeSchema,
  type ApiMeta,
  type BookmarksEnvelope,
  type EbirdEnvelope,
  type LlmdashEnvelope,
  type LocationSelector,
  type TideEnvelope,
  type WeatherEnvelope,
} from '../shared/contracts'
import { readEligibleLocation, readSnapshot, saveLocation, saveSnapshot } from '../lib/storage'

export type RefreshStatus = 'refreshing' | 'idle' | 'failed'

export type WidgetState<T> =
  | { status: 'loading'; data: null; message: null }
  | {
      status: 'ready'
      data: T
      message: string | null
      refreshStatus: RefreshStatus
    }
  | { status: 'error'; data: null; message: string }

export interface DashboardData {
  weather: WidgetState<WeatherEnvelope>
  bookmarks: WidgetState<BookmarksEnvelope>
  ebird: WidgetState<EbirdEnvelope>
  llmdash: WidgetState<LlmdashEnvelope>
  tide: WidgetState<TideEnvelope>
}

export type WidgetName = keyof DashboardData

type SchemaByWidget = {
  weather: typeof weatherEnvelopeSchema
  bookmarks: typeof bookmarksEnvelopeSchema
  ebird: typeof ebirdEnvelopeSchema
  llmdash: typeof llmdashEnvelopeSchema
  tide: typeof tideEnvelopeSchema
}

const widgetNames: WidgetName[] = ['weather', 'bookmarks', 'ebird', 'llmdash', 'tide']

const widgetLabels: Record<WidgetName, string> = {
  weather: 'Weather',
  bookmarks: 'Bookmarks',
  ebird: 'eBird',
  llmdash: 'llmdash',
  tide: 'Tide',
}

const snapshotKeys: Record<WidgetName, string> = {
  weather: 'homedash.cache.weather.v1',
  bookmarks: 'homedash.cache.bookmarks.v1',
  ebird: 'homedash.cache.ebird.v1',
  llmdash: 'homedash.cache.llmdash.v1',
  tide: 'homedash.cache.tide.v1',
}

const schemas: SchemaByWidget = {
  weather: weatherEnvelopeSchema,
  bookmarks: bookmarksEnvelopeSchema,
  ebird: ebirdEnvelopeSchema,
  llmdash: llmdashEnvelopeSchema,
  tide: tideEnvelopeSchema,
}

function staleCopy<T extends { meta: ApiMeta }>(value: T, failureMessage?: string): T {
  const refreshIssue = failureMessage
    ? {
        code: 'upstream-unavailable' as const,
        message: failureMessage,
        retryable: true,
      }
    : null
  return {
    ...value,
    meta: {
      ...value.meta,
      freshness: 'stale',
      issues: refreshIssue
        ? [refreshIssue, ...value.meta.issues.filter((issue) => issue.message !== failureMessage)]
        : value.meta.issues,
    },
  }
}

function hydratedWidget<K extends WidgetName>(name: K): DashboardData[K] {
  const snapshot = readSnapshot(
    snapshotKeys[name],
    (name === 'bookmarks' ? storedBookmarksEnvelopeSchema : schemas[name]) as z.ZodType,
  )
  if (!snapshot || typeof snapshot !== 'object' || !('meta' in snapshot)) {
    return { status: 'loading', data: null, message: null } as DashboardData[K]
  }
  return {
    status: 'ready',
    data: staleCopy(snapshot as { meta: ApiMeta }),
    message: null,
    refreshStatus: 'refreshing',
  } as DashboardData[K]
}

function hydrateDashboardData(): DashboardData {
  return {
    weather: hydratedWidget('weather'),
    bookmarks: hydratedWidget('bookmarks'),
    ebird: hydratedWidget('ebird'),
    llmdash: hydratedWidget('llmdash'),
    tide: hydratedWidget('tide'),
  }
}

function currentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('unsupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 0,
    })
  })
}

async function errorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: unknown }
    return typeof body.message === 'string' ? body.message : fallback
  } catch {
    return fallback
  }
}

function remainingMessage(count: number) {
  if (count === 0) return 'All refreshes finished.'
  return `${count} ${count === 1 ? 'source is' : 'sources are'} still refreshing.`
}

export function useDashboardData(onAnnouncement?: (message: string) => void) {
  const [data, setData] = useState<DashboardData>(hydrateDashboardData)
  const [initialCachedCount] = useState(
    () => widgetNames.filter((name) => data[name].status === 'ready').length,
  )
  const dataRef = useRef(data)
  const [selector, setSelector] = useState<LocationSelector | null>(null)
  const activeSourcesRef = useRef(new Set<WidgetName>(widgetNames))
  const [activeSources, setActiveSources] = useState<WidgetName[]>(widgetNames)
  const [isLocating, setLocating] = useState(true)
  const [locationMessage, setLocationMessage] = useState('Requesting this device’s location…')
  const started = useRef(false)

  const updateData = useCallback((updater: (current: DashboardData) => DashboardData) => {
    setData((current) => {
      const next = updater(current)
      dataRef.current = next
      return next
    })
  }, [])

  const setWidget = useCallback(
    <K extends WidgetName>(name: K, value: DashboardData[K]) => {
      updateData((current) => ({ ...current, [name]: value }))
    },
    [updateData],
  )

  const beginSources = useCallback((names: WidgetName[]) => {
    const next = new Set(activeSourcesRef.current)
    names.forEach((name) => next.add(name))
    activeSourcesRef.current = next
    setActiveSources([...next])
  }, [])

  const settleSource = useCallback(
    (name: WidgetName, outcome: 'updated' | 'failed-saved' | 'failed-empty') => {
      const next = new Set(activeSourcesRef.current)
      next.delete(name)
      activeSourcesRef.current = next
      setActiveSources([...next])
      const label = widgetLabels[name]
      const result =
        outcome === 'updated'
          ? `${label} updated.`
          : outcome === 'failed-saved'
            ? `${label} refresh failed. Its saved reading remains visible.`
            : `${label} could not be loaded.`
      onAnnouncement?.(`${result} ${remainingMessage(next.size)}`)
    },
    [onAnnouncement],
  )

  const markWidgetRefreshing = useCallback(
    (name: WidgetName) => {
      updateData((current) => {
        const widget = current[name]
        const next =
          widget.status === 'ready'
            ? { ...widget, message: null, refreshStatus: 'refreshing' as const }
            : { status: 'loading' as const, data: null, message: null }
        return { ...current, [name]: next }
      })
    },
    [updateData],
  )

  const load = useCallback(
    async <K extends WidgetName>(
      name: K,
      url: string,
      schema: SchemaByWidget[K],
      init: RequestInit,
      force: boolean,
    ) => {
      beginSources([name])
      markWidgetRefreshing(name)
      try {
        const response = await fetch(url, {
          ...init,
          headers: {
            accept: 'application/json',
            ...(init.body ? { 'content-type': 'application/json' } : {}),
            ...(force ? { 'x-homedash-refresh': '1' } : {}),
          },
        })
        if (!response.ok)
          throw new Error(await errorMessage(response, `${name} could not be loaded.`))
        const parsed = (schema as z.ZodType).safeParse(await response.json())
        if (!parsed.success) throw new Error(`${name} returned an unreadable response.`)
        saveSnapshot(snapshotKeys[name], parsed.data)
        setWidget(name, {
          status: 'ready',
          data: parsed.data,
          message: null,
          refreshStatus: 'idle',
        } as DashboardData[K])
        settleSource(name, 'updated')
      } catch (error) {
        const message = error instanceof Error ? error.message : `${name} could not be loaded.`
        const current = dataRef.current[name]
        const snapshot =
          current.status === 'ready'
            ? current.data
            : readSnapshot(snapshotKeys[name], schema as z.ZodType)
        if (snapshot && typeof snapshot === 'object' && 'meta' in snapshot) {
          setWidget(name, {
            status: 'ready',
            data: staleCopy(snapshot as { meta: ApiMeta }, message),
            message,
            refreshStatus: 'failed',
          } as DashboardData[K])
          settleSource(name, 'failed-saved')
          return
        }
        setWidget(name, {
          status: 'error',
          data: null,
          message,
        } as DashboardData[K])
        settleSource(name, 'failed-empty')
      }
    },
    [beginSources, markWidgetRefreshing, setWidget, settleSource],
  )

  const loadLocationWidget = useCallback(
    async (name: 'weather' | 'ebird', location: LocationSelector, force: boolean) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      if (name === 'weather') {
        await load(
          'weather',
          '/api/weather',
          weatherEnvelopeSchema,
          { method: 'POST', body: JSON.stringify(location) },
          force,
        )
        return
      }
      await load(
        'ebird',
        '/api/ebird/summary',
        ebirdEnvelopeSchema,
        { method: 'POST', body: JSON.stringify({ location, timeZone }) },
        force,
      )
    },
    [load],
  )

  const loadLocationSources = useCallback(
    async (location: LocationSelector, force: boolean) => {
      await Promise.allSettled([
        loadLocationWidget('weather', location, force),
        loadLocationWidget('ebird', location, force),
      ])
    },
    [loadLocationWidget],
  )

  const loadTide = useCallback(
    async (force: boolean) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      await load(
        'tide',
        '/api/tide',
        tideEnvelopeSchema,
        { method: 'POST', body: JSON.stringify({ timeZone }) },
        force,
      )
    },
    [load],
  )

  const chooseLocation = useCallback(async () => {
    setLocating(true)
    setLocationMessage('Requesting this device’s location…')
    beginSources(['weather', 'ebird'])
    markWidgetRefreshing('weather')
    markWidgetRefreshing('ebird')
    try {
      const position = await currentPosition()
      const capturedAt = new Date(position.timestamp || Date.now()).toISOString()
      const stored = {
        schemaVersion: 1 as const,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        capturedAt,
      }
      saveLocation(stored)
      const next: LocationSelector = { kind: 'current', ...stored }
      setSelector(next)
      setLocationMessage('Using this device’s current location.')
      await loadLocationSources(next, true)
      return
    } catch (error) {
      const cached = readEligibleLocation()
      const next: LocationSelector = cached ? { kind: 'last-known', ...cached } : { kind: 'home' }
      setSelector(next)
      const denied =
        typeof error === 'object' && error !== null && 'code' in error && Number(error.code) === 1
      setLocationMessage(
        cached
          ? `${denied ? 'Location permission was denied. ' : ''}Using a recent location saved on this device.`
          : `${denied ? 'Location permission was denied. ' : ''}Trying the configured home fallback.`,
      )
      await loadLocationSources(next, true)
    } finally {
      setLocating(false)
    }
  }, [beginSources, loadLocationSources, markWidgetRefreshing])

  const refreshAll = useCallback(async () => {
    beginSources(widgetNames)
    onAnnouncement?.(
      widgetNames.some((name) => dataRef.current[name].status === 'ready')
        ? 'Showing saved readings while five sources refresh.'
        : 'Refreshing all five dashboard sources.',
    )
    await Promise.allSettled([
      selector ? loadLocationSources(selector, true) : chooseLocation(),
      load('bookmarks', '/api/bookmarks', bookmarksEnvelopeSchema, {}, true),
      load('llmdash', '/api/llmdash/summary', llmdashEnvelopeSchema, {}, true),
      loadTide(true),
    ])
  }, [beginSources, chooseLocation, load, loadLocationSources, loadTide, onAnnouncement, selector])

  const retryWidget = useCallback(
    async (name: WidgetName) => {
      onAnnouncement?.(`${widgetLabels[name]} is refreshing; its saved reading remains visible.`)
      if (name === 'weather' || name === 'ebird') {
        await loadLocationWidget(name, selector ?? { kind: 'home' }, true)
        return
      }
      if (name === 'bookmarks') {
        await load('bookmarks', '/api/bookmarks', bookmarksEnvelopeSchema, {}, true)
        return
      }
      if (name === 'llmdash') {
        await load('llmdash', '/api/llmdash/summary', llmdashEnvelopeSchema, {}, true)
        return
      }
      await loadTide(true)
    },
    [load, loadLocationWidget, loadTide, onAnnouncement, selector],
  )

  const acceptSavedBookmarks = useCallback(
    (value: BookmarksEnvelope) => {
      const parsed = bookmarksEnvelopeSchema.safeParse(value)
      if (!parsed.success) return false
      saveSnapshot(snapshotKeys.bookmarks, parsed.data)
      setWidget('bookmarks', {
        status: 'ready',
        data: parsed.data,
        message: null,
        refreshStatus: 'idle',
      })
      return true
    },
    [setWidget],
  )

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (initialCachedCount) {
      onAnnouncement?.('Showing saved readings while five sources refresh.')
    }
    void load('bookmarks', '/api/bookmarks', bookmarksEnvelopeSchema, {}, false)
    void load('llmdash', '/api/llmdash/summary', llmdashEnvelopeSchema, {}, false)
    void loadTide(false)
    void chooseLocation()
  }, [chooseLocation, initialCachedCount, load, loadTide, onAnnouncement])

  const visibleSourceCount = widgetNames.filter((name) => data[name].status === 'ready').length

  return {
    data,
    selector,
    isRefreshing: activeSources.length > 0,
    refreshProgress: widgetNames.length - activeSources.length,
    visibleSourceCount,
    isLocating,
    locationMessage,
    retryLocation: chooseLocation,
    retryWidget,
    refreshAll,
    acceptSavedBookmarks,
  }
}
