import * as ToggleGroup from '@radix-ui/react-toggle-group'
import type { EbirdSummary, EbirdTarget, TargetSort } from '../shared/contracts'
import { formatDistance, formatObserved } from '../lib/format'

export type TargetCategory = keyof EbirdSummary['targets']

export function TargetTabs({
  category,
  summary,
  targetSort,
  dense = false,
  onCategory,
}: {
  category: TargetCategory
  summary: EbirdSummary
  targetSort: TargetSort
  dense?: boolean
  onCategory: (category: TargetCategory) => void
}) {
  return (
    <ToggleGroup.Root
      className={dense ? 'dense-target-controls' : 'target-tabs'}
      type="single"
      value={category}
      aria-label="eBird target category"
      onValueChange={(next) => {
        if (next === 'lifer' || next === 'photo' || next === 'audio') onCategory(next)
      }}
    >
      {(['lifer', 'photo', 'audio'] as const).map((name) => (
        <ToggleGroup.Item key={name} value={name} disabled={!summary.targetAvailability[name]}>
          {name === 'lifer' ? 'Lifers' : name[0].toUpperCase() + name.slice(1)} ·{' '}
          {summary.targetAvailability[name] ? summary.targetOrders[targetSort][name].length : '—'}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}

export function TargetOrder({
  value,
  dense = false,
  onValueChange,
}: {
  value: TargetSort
  dense?: boolean
  onValueChange: (value: TargetSort) => void
}) {
  return (
    <div className={dense ? 'target-order dense-target-order' : 'target-order'}>
      <span className="target-order-label">Order</span>
      <ToggleGroup.Root
        className="target-order-options"
        type="single"
        value={value}
        aria-label="eBird target order"
        onValueChange={(next) => {
          if (next === 'distance' || next === 'recent') onValueChange(next)
        }}
      >
        <ToggleGroup.Item value="distance">Nearest</ToggleGroup.Item>
        <ToggleGroup.Item value="recent">Recent</ToggleGroup.Item>
      </ToggleGroup.Root>
    </div>
  )
}

export function TargetList({
  targets,
  dense = false,
}: {
  targets: EbirdTarget[]
  dense?: boolean
}) {
  if (!targets.length) return <p className="empty-copy">No qualifying nearby targets right now.</p>
  return (
    <div className={dense ? 'dense-target-list' : 'target-list'} aria-live="polite">
      {targets.map((target) => {
        const content = (
          <>
            <strong title={target.commonName}>{target.commonName}</strong>
            <span className="distance">{formatDistance(target.distanceKm)}</span>
            <span className="where" title={target.locality}>
              {target.locality}
            </span>
            <time dateTime={target.observedAt}>{formatObserved(target.observedAt)}</time>
          </>
        )
        return /^[a-z0-9]{3,24}$/.test(target.speciesCode) ? (
          <a
            className="target-item"
            key={target.speciesCode}
            href={`/launch/ebird/map/${encodeURIComponent(target.speciesCode)}`}
            aria-label={`Open eBird map for ${target.commonName}`}
          >
            {content}
          </a>
        ) : (
          <div className="target-item" key={target.speciesCode}>
            {content}
          </div>
        )
      })}
    </div>
  )
}
