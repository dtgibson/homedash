import type { DashboardData } from '../hooks/useDashboardData'
import { formatAge, formatMiles, signed } from '../lib/format'
import type { TargetCategory } from './Targets'
import { BookmarkGroups } from './Bookmarks'
import { DawnProvider } from './Quota'
import { TargetList, TargetTabs } from './Targets'
import { DawnWeather, LocationProvenance, SunArc } from './Weather'
import { ErrorState, LoadingState, StateBadge, StateNote } from './WidgetState'

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
  onRetry: () => void
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
        <article className="story weather-story data-block" aria-labelledby="weather-heading">
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
          {data.weather.status === 'loading' && (
            <LoadingState message="Asking Open-Meteo for the latest reading…" />
          )}
          {data.weather.status === 'error' && (
            <ErrorState
              title="Weather could not be reached."
              message={data.weather.message}
              onRetry={onRetry}
            />
          )}
          {weather && <DawnWeather envelope={weather} />}
        </article>

        <article className="story bird-story data-block" aria-labelledby="bird-heading">
          <div className="story-heading">
            <h2 id="bird-heading">Birding pulse</h2>
            {ebird && (
              <StateBadge meta={ebird.meta}>
                Synced {formatAge(ebird.data.profileUpdatedAt)}
              </StateBadge>
            )}
          </div>
          {data.ebird.status === 'loading' && (
            <LoadingState message="Matching nearby sightings to your eBird history…" />
          )}
          {data.ebird.status === 'error' && (
            <ErrorState
              title="Nearby targets are resting."
              message={data.ebird.message}
              onRetry={onRetry}
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
              <StateNote meta={ebird.meta} />
            </>
          )}
        </article>

        <aside className="story utility-story" aria-label="Coding runway and bookmarks">
          <section
            className="usage-story utility-section data-block"
            aria-labelledby="usage-heading"
          >
            <div className="usage-intro utility-head">
              <h2 id="usage-heading">Coding runway</h2>
              <a
                className="source-launch"
                href="/launch/llmdash"
                aria-label="Open llmdash dashboard"
              >
                llmdash{llmdash ? ` · ${formatAge(llmdash.meta.sourceUpdatedAt)}` : ''}
              </a>
            </div>
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
                onRetry={onRetry}
              />
            )}
            {llmdash && (
              <>
                {llmdash.data.providers.map((provider) => (
                  <DawnProvider provider={provider} key={provider.id} />
                ))}
                <StateNote meta={llmdash.meta} />
              </>
            )}
          </section>

          <section className="bookmarks-story utility-section" aria-labelledby="bookmark-heading">
            <div className="bookmarks-head utility-head">
              <h2 id="bookmark-heading">Places to go</h2>
              <span className="meta">
                {bookmarks
                  ? `${bookmarks.data.bookmarks.length} bookmarks · host order`
                  : 'host order'}
              </span>
            </div>
            {data.bookmarks.status === 'loading' && (
              <LoadingState message="Reading bookmark configuration…" />
            )}
            {data.bookmarks.status === 'error' && (
              <ErrorState
                title="Bookmarks need configuration."
                message={data.bookmarks.message}
                onRetry={onRetry}
              />
            )}
            {bookmarks && (
              <>
                <BookmarkGroups bookmarks={bookmarks.data.bookmarks} />
                <StateNote meta={bookmarks.meta} />
              </>
            )}
          </section>
        </aside>
      </div>
    </main>
  )
}
