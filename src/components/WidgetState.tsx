import type { ReactNode } from 'react'
import type { ApiMeta } from '../shared/contracts'

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
