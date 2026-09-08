import type { LlmdashSummary } from '../shared/contracts'
import { formatDateTime } from '../lib/format'

type Provider = LlmdashSummary['providers'][number]
type Window = Provider['fiveHour']

function Meter({ value }: { value: number }) {
  return (
    <span className="quota-meter" aria-hidden="true">
      <span style={{ width: `${value}%` }} />
    </span>
  )
}

export function QuotaWindow({ label, window }: { label: string; window: Window }) {
  if (!window) {
    return (
      <div className="quota-line unavailable">
        <span>{label}</span>
        <span className="quota-meter" aria-hidden="true" />
        <strong>— · unavailable</strong>
      </div>
    )
  }
  return (
    <div className="quota-line">
      <span>{label}</span>
      <Meter value={window.remainingPct} />
      <strong>
        {Math.round(window.remainingPct)}% · {formatDateTime(window.resetsAt)}
      </strong>
    </div>
  )
}

export function DawnProvider({ provider }: { provider: Provider }) {
  return (
    <div className={`provider ${provider.id}`}>
      <div className="provider-heading">
        <span className="provider-name">
          <span className="provider-dot" />
          {provider.label}
        </span>
        <span className="state-badge" data-state={provider.diagnostic ? 'partial' : 'fresh'}>
          {provider.diagnostic ? 'Partial' : 'Live'}
        </span>
      </div>
      <QuotaWindow label="5 hour" window={provider.fiveHour} />
      <QuotaWindow label="Weekly" window={provider.weekly} />
    </div>
  )
}

function DenseWindow({ label, window }: { label: string; window: Window }) {
  if (!window) {
    return (
      <span className="dense-quota unavailable">
        <span>{label}</span>
        <strong>—</strong>
        <span className="dense-meter" />
        <span>unavailable</span>
      </span>
    )
  }
  return (
    <span className="dense-quota">
      <span>{label}</span>
      <strong>{Math.round(window.remainingPct)}%</strong>
      <span className="dense-meter" aria-hidden="true">
        <span style={{ width: `${window.remainingPct}%` }} />
      </span>
      <span>reset {formatDateTime(window.resetsAt)}</span>
    </span>
  )
}

export function DenseProvider({ provider }: { provider: Provider }) {
  return (
    <div className="dense-provider">
      <span className={`dense-provider-name ${provider.id}`}>{provider.label}</span>
      <DenseWindow label="5h" window={provider.fiveHour} />
      <DenseWindow label="wk" window={provider.weekly} />
    </div>
  )
}
