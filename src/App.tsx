import { useCallback, useEffect, useRef, useState } from 'react'
import { DawnView } from './components/DawnView'
import { DenseView } from './components/DenseView'
import type { TargetCategory } from './components/Targets'
import { Toolbar } from './components/Toolbar'
import { useDashboardData, type WidgetName } from './hooks/useDashboardData'
import { useMoonPhase } from './hooks/useMoonPhase'
import { usePreferences } from './hooks/usePreferences'

export default function App() {
  const { preferences, setPreferences } = usePreferences()
  const [category, setCategory] = useState<TargetCategory>('lifer')
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | null>(null)

  const announce = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }, [])
  const dashboard = useDashboardData(announce)
  const moonPhase = useMoonPhase()

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  const retryAll = async () => {
    try {
      await dashboard.refreshAll()
    } finally {
      moonPhase.reevaluate()
    }
  }

  const retrySource = (source: WidgetName) => {
    void dashboard.retryWidget(source).finally(moonPhase.reevaluate)
  }

  const retryLocation = async () => {
    announce('Requesting this device’s location…')
    try {
      await dashboard.retryLocation()
      announce(dashboard.locationMessage)
    } finally {
      moonPhase.reevaluate()
    }
  }

  return (
    <div className="shell">
      <Toolbar
        preferences={preferences}
        onPreferences={(next) => {
          setPreferences(next)
          announce(
            `${next.mode === 'dawn' ? 'Dawn' : 'Dense'} view · ${next.appearance} appearance saved on this device.`,
          )
        }}
        onLocation={() => void retryLocation()}
        onRefresh={() => void retryAll()}
        onStatus={announce}
        locating={dashboard.isLocating}
        refreshing={dashboard.isRefreshing}
        refreshProgress={dashboard.refreshProgress}
        visibleSourceCount={dashboard.visibleSourceCount}
      />
      {preferences.mode === 'dawn' ? (
        <DawnView
          data={dashboard.data}
          moonPhase={moonPhase.label}
          category={category}
          onCategory={(next) => {
            setCategory(next)
            announce(`${next} targets selected · closest first.`)
          }}
          onRetry={retrySource}
        />
      ) : (
        <DenseView
          data={dashboard.data}
          moonPhase={moonPhase.label}
          category={category}
          onCategory={(next) => {
            setCategory(next)
            announce(`${next} targets selected · closest first.`)
          }}
          onRetry={retrySource}
        />
      )}
      <div className={`status-line ${toast ? 'is-visible' : ''}`} role="status" aria-live="polite">
        {toast || dashboard.locationMessage}
      </div>
    </div>
  )
}
