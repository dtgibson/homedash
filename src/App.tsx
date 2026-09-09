import { useCallback, useEffect, useRef, useState } from 'react'
import { DawnView } from './components/DawnView'
import { DenseView } from './components/DenseView'
import { SettingsDialog } from './components/SettingsDialog'
import type { TargetCategory } from './components/Targets'
import { Toolbar } from './components/Toolbar'
import { useDashboardData, type WidgetName } from './hooks/useDashboardData'
import { useMoonPhase } from './hooks/useMoonPhase'
import { usePreferences } from './hooks/usePreferences'

export default function App() {
  const { preferences, setPreferences } = usePreferences()
  const [category, setCategory] = useState<TargetCategory>('lifer')
  const [toast, setToast] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const toastTimer = useRef<number | null>(null)
  const settingsTriggerRef = useRef<HTMLButtonElement>(null)

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
    <>
      <div
        className="shell"
        aria-hidden={settingsOpen ? true : undefined}
        inert={settingsOpen ? true : undefined}
      >
        <Toolbar
          settingsTriggerRef={settingsTriggerRef}
          onSettings={() => setSettingsOpen(true)}
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
      </div>
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        triggerRef={settingsTriggerRef}
        preferences={preferences}
        onPreferences={(next) => {
          const retained = setPreferences(next)
          announce(
            retained
              ? `${next.mode === 'dawn' ? 'Dawn' : 'Dense'} view · ${next.appearance} appearance saved on this device.`
              : `${next.mode === 'dawn' ? 'Dawn' : 'Dense'} view · ${next.appearance} appearance applied, but this browser could not retain it.`,
          )
        }}
        onSaved={dashboard.acceptSavedBookmarks}
        onAnnounce={announce}
      />
      <div className={`status-line ${toast ? 'is-visible' : ''}`} role="status" aria-live="polite">
        {toast || dashboard.locationMessage}
      </div>
    </>
  )
}
