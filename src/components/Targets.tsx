import * as ToggleGroup from '@radix-ui/react-toggle-group'
import type { EbirdSummary, EbirdTarget } from '../shared/contracts'
import { formatDistance, formatObserved } from '../lib/format'

export type TargetCategory = keyof EbirdSummary['targets']

export function TargetTabs({
  category,
  summary,
  dense = false,
  onCategory,
}: {
  category: TargetCategory
  summary: EbirdSummary
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
          {summary.targetAvailability[name] ? summary.targets[name].length : '—'}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
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
      {targets.map((target) => (
        <div className="target-item" key={target.speciesCode}>
          <strong>{target.commonName}</strong>
          <span className="distance">{formatDistance(target.distanceKm)}</span>
          <span className="where" title={target.locality}>
            {target.locality}
          </span>
          <time dateTime={target.observedAt}>{formatObserved(target.observedAt)}</time>
        </div>
      ))}
    </div>
  )
}
