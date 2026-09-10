import type { ReactNode } from 'react'
import type { WidgetName, WidgetState as DashboardWidgetState } from '../hooks/useDashboardData'
import { formatAge, formatTime } from '../lib/format'
import type { ApiMeta } from '../shared/contracts'

const sourceLabels: Record<WidgetName, string> = {
  weather: 'weather',
  bookmarks: 'bookmarks',
  ebird: 'eBird',
  llmdash: 'llmdash',
  tide: 'tide',
}

export function LoadingState({ message }: { message: string }) {
  return (
    <div className="loading-copy" role="status" aria-label={message}>
      <span />
      <span />
      <span />
      <p className="meta">{message}</p>
    </div>
  )
}

export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry: () => void
}) {
  return (
    <div className="error-copy" role="status">
      <strong>{title}</strong>
      <p>{message}</p>
      <button className="retry-link" type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}

function compactAge(value: string | null) {
  return formatAge(value).replace(' ago', ' old').replace('unknown age', 'age unknown')
}

export function SourceFreshness<T extends { meta: ApiMeta }>({
  source,
  state,
  onRetry,
}: {
  source: WidgetName
  state: DashboardWidgetState<T>
  onRetry: (source: WidgetName) => void
}) {
  if (state.status !== 'ready') return null
  const timestamp = state.data.meta.sourceUpdatedAt ?? state.data.meta.generatedAt
  const age = formatAge(timestamp)
  const fullAge =
    age === 'just now' ? 'Updated just now' : `Updated ${formatTime(timestamp)} · ${age}`
  const sourceState =
    state.refreshStatus === 'refreshing'
      ? 'refreshing'
      : state.refreshStatus === 'failed'
        ? 'failed'
        : state.data.meta.freshness === 'stale'
          ? 'stale'
          : state.data.meta.issues.length
            ? 'partial'
            : 'fresh'
  const action =
    sourceState === 'refreshing'
      ? 'Refreshing'
      : sourceState === 'failed'
        ? 'Refresh failed'
        : sourceState === 'stale'
          ? 'Source is stale'
          : sourceState === 'partial'
            ? 'Partially updated'
            : 'Up to date'
  const failureDetail = sourceState === 'failed' ? 'Saved reading remains.' : ''

  return (
    <div
      className="source-freshness"
      data-state={sourceState}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`${fullAge}. ${action}.${failureDetail ? ` ${failureDetail}` : ''}`}
    >
      <span className="freshness-icon" aria-hidden="true" />
      <span className="freshness-age">
        <span className="freshness-full">{fullAge}</span>
        <span className="freshness-compact">{compactAge(timestamp)}</span>
      </span>
      <span className="freshness-separator" aria-hidden="true">
        ·
      </span>
      <span className="freshness-action">{action}</span>
      {failureDetail && <span className="freshness-detail">{failureDetail}</span>}
      {sourceState === 'failed' && (
        <button
          className="freshness-retry"
          type="button"
          onClick={() => onRetry(source)}
          aria-label={`Try ${sourceLabels[source]} again`}
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function StateBadge({ meta, children }: { meta: ApiMeta; children?: ReactNode }) {
  const state = meta.issues.length
    ? meta.freshness === 'stale'
      ? 'stale'
      : 'partial'
    : meta.freshness
  return (
    <span className="state-badge" data-state={state}>
      {children ?? state}
    </span>
  )
}

export function StateNote({ meta }: { meta: ApiMeta }) {
  if (meta.freshness === 'fresh' && meta.issues.length === 0) return null
  return (
    <div className="partial-note" role="status">
      <span>{meta.issues[0]?.message ?? 'This reading is older than its freshness window.'}</span>
      <span>{meta.freshness === 'stale' ? 'Stale' : 'Partial'}</span>
    </div>
  )
}
