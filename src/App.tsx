import { useEffect, useRef, useState } from 'react'
import { DawnView } from './components/DawnView'
import { DenseView } from './components/DenseView'
import type { TargetCategory } from './components/Targets'
import { Toolbar } from './components/Toolbar'
import { useDashboardData } from './hooks/useDashboardData'
import { usePreferences } from './hooks/usePreferences'

export default function App() {
  const { preferences, setPreferences } = usePreferences()
  const dashboard = useDashboardData()
  const [category, setCategory] = useState<TargetCategory>('lifer')
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | null>(null)

  const announce = (message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  const retryAll = async () => {
    announce('Refreshing each dashboard source independently…')
    await dashboard.refreshAll()
    announce('Refresh finished. Each source reports its current state below.')
  }

  const retryLocation = async () => {
    announce('Requesting this device’s location…')
    await dashboard.retryLocation()
    announce(dashboard.locationMessage)
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
        locating={dashboard.isLocating}
        refreshing={dashboard.isRefreshing}
      />
      {preferences.mode === 'dawn' ? (
        <DawnView
          data={dashboard.data}
          category={category}
          onCategory={(next) => {
            setCategory(next)
            announce(`${next} targets selected · closest first.`)
          }}
          onRetry={() => void retryAll()}
        />
      ) : (
        <DenseView
          data={dashboard.data}
          category={category}
          onCategory={(next) => {
            setCategory(next)
            announce(`${next} targets selected · closest first.`)
          }}
          onRetry={() => void retryAll()}
        />
      )}
      <div className={`status-line ${toast ? 'is-visible' : ''}`} role="status" aria-live="polite">
        {toast || dashboard.locationMessage}
      </div>
    </div>
  )
}
