import type { DashboardData } from '../hooks/useDashboardData'
import { formatAge, signed } from '../lib/format'
import type { TargetCategory } from './Targets'
import { BookmarkGroups } from './Bookmarks'
import { DenseProvider } from './Quota'
import { TargetList, TargetTabs } from './Targets'
import { DenseWeather } from './Weather'
import { ErrorState, LoadingState, StateNote } from './WidgetState'

interface DenseViewProps {
  data: DashboardData
  category: TargetCategory
  onCategory: (category: TargetCategory) => void
  onRetry: () => void
}

export function DenseView({ data, category, onCategory, onRetry }: DenseViewProps) {
  const weather = data.weather.status === 'ready' ? data.weather.data : null
  const ebird = data.ebird.status === 'ready' ? data.ebird.data : null
  const llmdash = data.llmdash.status === 'ready' ? data.llmdash.data : null
  const bookmarks = data.bookmarks.status === 'ready' ? data.bookmarks.data : null
  const liveSources = Object.values(data).filter((widget) => widget.status === 'ready').length
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
        <span className="state-badge" data-state={liveSources === 4 ? 'fresh' : 'partial'}>
          {liveSources} of 4 sources ready
        </span>
      </header>

      <section className="dense-row" aria-labelledby="dense-weather">
        <h2 className="dense-label" id="dense-weather">
          Weather
        </h2>
        <div className="dense-content">
          {data.weather.status === 'loading' && <LoadingState message="Reading weather…" />}
          {data.weather.status === 'error' && (
            <ErrorState title="No weather." message={data.weather.message} onRetry={onRetry} />
          )}
          {weather && <DenseWeather envelope={weather} />}
        </div>
      </section>

      <section className="dense-row" aria-labelledby="dense-ebird">
        <h2 className="dense-label" id="dense-ebird">
          eBird
        </h2>
        <div className="dense-content">
          {data.ebird.status === 'loading' && <LoadingState message="Reading nearby targets…" />}
          {data.ebird.status === 'error' && (
            <ErrorState title="No nearby targets." message={data.ebird.message} onRetry={onRetry} />
          )}
          {ebird && (
            <>
              <div className="dense-wrap">
                <span className="dense-primary dense-green">
                  {ebird.data.month.currentCount} species
                </span>
                <span className="dense-soft">
                  {ebird.data.month.label.toLowerCase()} 1–{ebird.data.month.throughDay}
                </span>
                <span className="dense-primary dense-green">
                  {signed(ebird.data.month.difference)}
                </span>
                <span className="dense-faint">vs {ebird.data.month.previousCount} last year</span>
                <span className="dense-faint">within {ebird.data.radiusKm} km · closest first</span>
                <span className="dense-faint">
                  profile {formatAge(ebird.data.profileUpdatedAt)}
                </span>
              </div>
              <TargetTabs dense category={category} summary={ebird.data} onCategory={onCategory} />
              <TargetList dense targets={ebird.data.targets[category]} />
              <StateNote meta={ebird.meta} />
            </>
          )}
        </div>
      </section>

      <section className="dense-row" aria-labelledby="dense-llmdash">
        <h2 className="dense-label" id="dense-llmdash">
          llmdash
        </h2>
        <div className="dense-content">
          {data.llmdash.status === 'loading' && <LoadingState message="Reading coding runway…" />}
          {data.llmdash.status === 'error' && (
            <ErrorState
              title="No coding runway."
              message={data.llmdash.message}
              onRetry={onRetry}
            />
          )}
          {llmdash && (
            <>
              {llmdash.data.providers.map((provider) => (
                <DenseProvider provider={provider} key={provider.id} />
              ))}
              <StateNote meta={llmdash.meta} />
            </>
          )}
        </div>
      </section>

      <section className="dense-row" aria-labelledby="dense-bookmarks">
        <h2 className="dense-label" id="dense-bookmarks">
          Bookmarks
        </h2>
        <div className="dense-content">
          {data.bookmarks.status === 'loading' && <LoadingState message="Reading bookmarks…" />}
          {data.bookmarks.status === 'error' && (
            <ErrorState title="No bookmarks." message={data.bookmarks.message} onRetry={onRetry} />
          )}
          {bookmarks && (
            <>
              <BookmarkGroups dense bookmarks={bookmarks.data.bookmarks} />
              <StateNote meta={bookmarks.meta} />
            </>
          )}
        </div>
      </section>
    </main>
  )
}
