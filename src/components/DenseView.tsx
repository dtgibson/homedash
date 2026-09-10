import type { DashboardData, WidgetName } from '../hooks/useDashboardData'
import { formatAge, formatRadiusMiles, signed } from '../lib/format'
import type { MoonPhaseLabel } from '../lib/moonPhase'
import type { TargetSort } from '../shared/contracts'
import type { TargetCategory } from './Targets'
import { BookmarkGroups } from './Bookmarks'
import { DenseProvider } from './Quota'
import { TargetList, TargetOrder, TargetTabs } from './Targets'
import { DenseTide } from './Tide'
import { DenseDaylight, DenseWeather } from './Weather'
import { ErrorState, LoadingState, SourceFreshness } from './WidgetState'

interface DenseViewProps {
  data: DashboardData
  moonPhase: MoonPhaseLabel | null
  category: TargetCategory
  targetSort: TargetSort
  onCategory: (category: TargetCategory) => void
  onTargetSort: (targetSort: TargetSort) => void
  onRetry: (source: WidgetName) => void
}

export function DenseView({
  data,
  moonPhase,
  category,
  targetSort,
  onCategory,
  onTargetSort,
  onRetry,
}: DenseViewProps) {
  const weather = data.weather.status === 'ready' ? data.weather.data : null
  const ebird = data.ebird.status === 'ready' ? data.ebird.data : null
  const llmdash = data.llmdash.status === 'ready' ? data.llmdash.data : null
  const bookmarks = data.bookmarks.status === 'ready' ? data.bookmarks.data : null
  const visibleSources = Object.values(data).filter((widget) => widget.status === 'ready').length
  const now = new Date()

  return (
    <main className="dense" aria-labelledby="dense-title">
      <header className="dense-head">
        <div className="dense-title">
          <strong id="dense-title">homedash</strong>
          <span>
            {new Intl.DateTimeFormat(undefined, {
              weekday: 'short',
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }).format(now)}
          </span>
        </div>
        <span className="state-badge" data-state={visibleSources === 5 ? 'fresh' : 'partial'}>
          {visibleSources} of 5 sources visible
        </span>
      </header>

      <div className="dense-grid">
        <section
          className="dense-row dense-weather-row data-block"
          data-source="weather"
          data-refresh-state={
            data.weather.status === 'ready' ? data.weather.refreshStatus : data.weather.status
          }
          aria-labelledby="dense-weather"
          aria-busy={
            data.weather.status === 'loading' ||
            (data.weather.status === 'ready' && data.weather.refreshStatus === 'refreshing')
          }
        >
          <h2 className="dense-label" id="dense-weather">
            Weather
          </h2>
          <div className="dense-content">
            <SourceFreshness source="weather" state={data.weather} onRetry={onRetry} />
            {data.weather.status === 'loading' && <LoadingState message="Reading weather…" />}
            {data.weather.status === 'error' && (
              <ErrorState
                title="No weather."
                message={data.weather.message}
                onRetry={() => onRetry('weather')}
              />
            )}
            {weather && <DenseWeather envelope={weather} />}
            <DenseDaylight envelope={weather} moonPhase={moonPhase} />
            <DenseTide state={data.tide} onRetry={() => onRetry('tide')} />
          </div>
        </section>

        <section
          className="dense-row dense-ebird-row data-block"
          data-source="ebird"
          data-refresh-state={
            data.ebird.status === 'ready' ? data.ebird.refreshStatus : data.ebird.status
          }
          aria-labelledby="dense-ebird"
          aria-busy={
            data.ebird.status === 'loading' ||
            (data.ebird.status === 'ready' && data.ebird.refreshStatus === 'refreshing')
          }
        >
          <h2 className="dense-label" id="dense-ebird">
            eBird
          </h2>
          <div className="dense-content">
            <SourceFreshness source="ebird" state={data.ebird} onRetry={onRetry} />
            {data.ebird.status === 'loading' && <LoadingState message="Reading nearby targets…" />}
            {data.ebird.status === 'error' && (
              <ErrorState
                title="No nearby targets."
                message={data.ebird.message}
                onRetry={() => onRetry('ebird')}
              />
            )}
            {ebird && (
              <>
                <div className="dense-wrap">
                  <a
                    className="dense-primary dense-green month-launch"
                    href="/launch/ebird/my-ebird"
                    aria-label={`Open My eBird for ${ebird.data.month.label} progress`}
                  >
                    {ebird.data.month.currentCount} species · My eBird
                  </a>
                  <span className="dense-soft">
                    {ebird.data.month.label.toLowerCase()} 1–{ebird.data.month.throughDay}
                  </span>
                  <span className="dense-primary dense-green">
                    {signed(ebird.data.month.difference)}
                  </span>
                  <span className="dense-faint">vs {ebird.data.month.previousCount} last year</span>
                  <span className="dense-faint">
                    profile {formatAge(ebird.data.profileUpdatedAt)}
                  </span>
                </div>
                <div className="target-context dense-target-context">
                  <span className="dense-faint">
                    within {formatRadiusMiles(ebird.data.radiusKm)}
                  </span>
                  <TargetOrder dense value={targetSort} onValueChange={onTargetSort} />
                </div>
                <TargetTabs
                  dense
                  category={category}
                  summary={ebird.data}
                  targetSort={targetSort}
                  onCategory={onCategory}
                />
                <TargetList dense targets={ebird.data.targetOrders[targetSort][category]} />
              </>
            )}
          </div>
        </section>

        <section
          className="dense-row dense-llmdash-row data-block"
          data-source="llmdash"
          data-refresh-state={
            data.llmdash.status === 'ready' ? data.llmdash.refreshStatus : data.llmdash.status
          }
          aria-labelledby="dense-llmdash"
          aria-busy={
            data.llmdash.status === 'loading' ||
            (data.llmdash.status === 'ready' && data.llmdash.refreshStatus === 'refreshing')
          }
        >
          <h2 className="dense-label" id="dense-llmdash">
            <a className="source-launch" href="/launch/llmdash" aria-label="Open llmdash dashboard">
              llmdash
            </a>
          </h2>
          <div className="dense-content">
            <SourceFreshness source="llmdash" state={data.llmdash} onRetry={onRetry} />
            {data.llmdash.status === 'loading' && <LoadingState message="Reading coding runway…" />}
            {data.llmdash.status === 'error' && (
              <ErrorState
                title="No coding runway."
                message={data.llmdash.message}
                onRetry={() => onRetry('llmdash')}
              />
            )}
            {llmdash && (
              <>
                {llmdash.data.providers.map((provider) => (
                  <DenseProvider provider={provider} key={provider.id} />
                ))}
              </>
            )}
          </div>
        </section>

        <section
          className="dense-row dense-bookmarks-row data-block"
          data-source="bookmarks"
          data-refresh-state={
            data.bookmarks.status === 'ready' ? data.bookmarks.refreshStatus : data.bookmarks.status
          }
          aria-labelledby="dense-bookmarks"
          aria-busy={
            data.bookmarks.status === 'loading' ||
            (data.bookmarks.status === 'ready' && data.bookmarks.refreshStatus === 'refreshing')
          }
        >
          <h2 className="dense-label" id="dense-bookmarks">
            Bookmarks
          </h2>
          <div className="dense-content">
            <SourceFreshness source="bookmarks" state={data.bookmarks} onRetry={onRetry} />
            {data.bookmarks.status === 'loading' && <LoadingState message="Reading bookmarks…" />}
            {data.bookmarks.status === 'error' && (
              <ErrorState
                title="No bookmarks."
                message={data.bookmarks.message}
                onRetry={() => onRetry('bookmarks')}
              />
            )}
            {bookmarks && (
              <>
                <BookmarkGroups
                  dense
                  bookmarks={bookmarks.data.bookmarks}
                  sections={bookmarks.data.sections}
                />
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
