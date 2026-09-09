import type { DashboardData, WidgetName } from '../hooks/useDashboardData'
import { formatAge, formatMiles, signed } from '../lib/format'
import type { TargetCategory } from './Targets'
import { BookmarkGroups } from './Bookmarks'
import { DawnProvider } from './Quota'
import { TargetList, TargetTabs } from './Targets'
import { DawnWeather, LocationProvenance, SunArc } from './Weather'
import { ErrorState, LoadingState, SourceFreshness, StateBadge } from './WidgetState'

function dayGreeting(date = new Date()) {
  const hour = date.getHours()
  return hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.'
}

function dateLabel(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

interface ViewProps {
  data: DashboardData
  category: TargetCategory
  onCategory: (category: TargetCategory) => void
  onRetry: (source: WidgetName) => void
}

export function DawnView({ data, category, onCategory, onRetry }: ViewProps) {
  const weather = data.weather.status === 'ready' ? data.weather.data : null
  const ebird = data.ebird.status === 'ready' ? data.ebird.data : null
  const llmdash = data.llmdash.status === 'ready' ? data.llmdash.data : null
  const bookmarks = data.bookmarks.status === 'ready' ? data.bookmarks.data : null

  const lede = weather
    ? `${weather.data.condition} with a high of ${Math.round(weather.data.high)}°. ${ebird ? `${ebird.data.targets[category].length} ${category} targets are nearby.` : 'Birding data is still arriving.'}`
    : 'Your weather, birding opportunities, coding runway, and destinations in one place.'

  return (
    <main className="dawn" aria-labelledby="dawn-title">
      <header className="dawn-masthead">
        <div className="dawn-heading-line">
          <p className="eyebrow">{dateLabel()}</p>
          <h1 id="dawn-title">{dayGreeting()}</h1>
          <p className="lede">{lede}</p>
        </div>
        {weather ? <SunArc envelope={weather} /> : <LoadingState message="Reading daylight…" />}
      </header>

      <div className="dawn-composition">
        <article
          className="story weather-story data-block"
          data-source="weather"
          data-refresh-state={
            data.weather.status === 'ready' ? data.weather.refreshStatus : data.weather.status
          }
          aria-labelledby="weather-heading"
          aria-busy={
            data.weather.status === 'loading' ||
            (data.weather.status === 'ready' && data.weather.refreshStatus === 'refreshing')
          }
        >
          <div className="story-heading">
            <h2 id="weather-heading">The day ahead</h2>
            {weather && (
              <div className="location-line">
                <span className="location-mark" aria-hidden="true">
                  ⌖
                </span>
                <LocationProvenance envelope={weather} />
              </div>
            )}
          </div>
          <SourceFreshness source="weather" state={data.weather} onRetry={onRetry} />
          {data.weather.status === 'loading' && (
            <LoadingState message="Asking Open-Meteo for the latest reading…" />
          )}
          {data.weather.status === 'error' && (
            <ErrorState
              title="Weather could not be reached."
              message={data.weather.message}
              onRetry={() => onRetry('weather')}
            />
          )}
          {weather && <DawnWeather envelope={weather} />}
        </article>

        <article
          className="story bird-story data-block"
          data-source="ebird"
          data-refresh-state={
            data.ebird.status === 'ready' ? data.ebird.refreshStatus : data.ebird.status
          }
          aria-labelledby="bird-heading"
          aria-busy={
            data.ebird.status === 'loading' ||
            (data.ebird.status === 'ready' && data.ebird.refreshStatus === 'refreshing')
          }
        >
          <div className="story-heading">
            <h2 id="bird-heading">Birding pulse</h2>
            {ebird && (
              <StateBadge meta={ebird.meta}>
                Synced {formatAge(ebird.data.profileUpdatedAt)}
              </StateBadge>
            )}
          </div>
          <SourceFreshness source="ebird" state={data.ebird} onRetry={onRetry} />
          {data.ebird.status === 'loading' && (
            <LoadingState message="Matching nearby sightings to your eBird history…" />
          )}
          {data.ebird.status === 'error' && (
            <ErrorState
              title="Nearby targets are resting."
              message={data.ebird.message}
              onRetry={() => onRetry('ebird')}
            />
          )}
          {ebird && (
            <>
              <a
                className="month-comparison"
                href="/launch/ebird/my-ebird"
                aria-label={`Open My eBird for ${ebird.data.month.label} progress`}
              >
                <div>
                  <p className="section-kicker">
                    {ebird.data.month.label} · {ebird.data.month.throughDay} days
                  </p>
                  <div className="month-number">
                    <strong>{ebird.data.month.currentCount}</strong>
                    <span>
                      species
                      <br />
                      this month
                    </span>
                  </div>
                </div>
                <div className="delta">
                  <strong>{signed(ebird.data.month.difference)}</strong>
                  <span>vs {ebird.data.month.previousCount} last year</span>
                  <span className="month-action">My eBird ↗</span>
                </div>
              </a>
              <p className="section-kicker">
                Top nearby targets · within {formatMiles(ebird.data.radiusKm)} · closest first
              </p>
              <TargetTabs category={category} summary={ebird.data} onCategory={onCategory} />
              <TargetList targets={ebird.data.targets[category]} />
            </>
          )}
        </article>

        <aside className="story utility-story" aria-label="Coding runway and bookmarks">
          <section
            className="usage-story utility-section data-block"
            data-source="llmdash"
            data-refresh-state={
              data.llmdash.status === 'ready' ? data.llmdash.refreshStatus : data.llmdash.status
            }
            aria-labelledby="usage-heading"
            aria-busy={
              data.llmdash.status === 'loading' ||
              (data.llmdash.status === 'ready' && data.llmdash.refreshStatus === 'refreshing')
            }
          >
            <div className="usage-intro utility-head">
              <h2 id="usage-heading">Coding runway</h2>
              <a
                className="source-launch"
                href="/launch/llmdash"
                aria-label="Open llmdash dashboard"
              >
                llmdash
              </a>
            </div>
            <SourceFreshness source="llmdash" state={data.llmdash} onRetry={onRetry} />
            <p className="utility-copy">
              Authoritative remaining headroom from llmdash. Missing windows stay unfilled.
            </p>
            {data.llmdash.status === 'loading' && (
              <LoadingState message="Reading authoritative limits from llmdash…" />
            )}
            {data.llmdash.status === 'error' && (
              <ErrorState
                title="Coding runway is unavailable."
                message={data.llmdash.message}
                onRetry={() => onRetry('llmdash')}
              />
            )}
            {llmdash && (
              <>
                {llmdash.data.providers.map((provider) => (
                  <DawnProvider provider={provider} key={provider.id} />
                ))}
              </>
            )}
          </section>

          <section
            className="bookmarks-story utility-section data-block"
            data-source="bookmarks"
            data-refresh-state={
              data.bookmarks.status === 'ready'
                ? data.bookmarks.refreshStatus
                : data.bookmarks.status
            }
            aria-labelledby="bookmark-heading"
            aria-busy={
              data.bookmarks.status === 'loading' ||
              (data.bookmarks.status === 'ready' && data.bookmarks.refreshStatus === 'refreshing')
            }
          >
            <div className="bookmarks-head utility-head">
              <h2 id="bookmark-heading">Places to go</h2>
              <span className="meta">
                {bookmarks
                  ? `${bookmarks.data.bookmarks.length} bookmarks · host order`
                  : 'host order'}
              </span>
            </div>
            <SourceFreshness source="bookmarks" state={data.bookmarks} onRetry={onRetry} />
            {data.bookmarks.status === 'loading' && (
              <LoadingState message="Reading bookmark configuration…" />
            )}
            {data.bookmarks.status === 'error' && (
              <ErrorState
                title="Bookmarks need configuration."
                message={data.bookmarks.message}
                onRetry={() => onRetry('bookmarks')}
              />
            )}
            {bookmarks && (
              <>
                <BookmarkGroups bookmarks={bookmarks.data.bookmarks} />
              </>
            )}
          </section>
        </aside>
      </div>
    </main>
  )
}
