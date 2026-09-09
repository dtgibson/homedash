import type { WeatherEnvelope } from '../shared/contracts'
import { formatAge, formatPercent, formatTemperature, formatTime } from '../lib/format'

export function LocationProvenance({ envelope }: { envelope: WeatherEnvelope }) {
  const location = envelope.meta.location
  if (!location) return null
  const source =
    location.kind === 'current'
      ? 'current device'
      : location.kind === 'last-known'
        ? `last known · ${formatAge(location.capturedAt)}`
        : 'home'
  return <span>{`${location.label} · ${source}`}</span>
}

export function SunArc({ envelope }: { envelope: WeatherEnvelope }) {
  const weather = envelope.data
  const sunrise = Date.parse(weather.sunrise)
  const sunset = Date.parse(weather.sunset)
  const progress = Math.max(
    0,
    Math.min(1, (Date.parse(envelope.meta.generatedAt) - sunrise) / Math.max(1, sunset - sunrise)),
  )
  const daylightHours = Math.floor(weather.daylightMinutes / 60)
  const daylightMinutes = weather.daylightMinutes % 60
  return (
    <div
      className="sun-arc"
      aria-label={`Sunrise ${formatTime(weather.sunrise)}, sunset ${formatTime(weather.sunset)}, ${daylightHours} hours ${daylightMinutes} minutes of daylight`}
    >
      <svg viewBox="0 0 520 150" aria-hidden="true">
        <path className="arc-track" pathLength="100" d="M12 130 Q260 -54 508 130" />
        <path
          className="arc-progress"
          pathLength="100"
          strokeDasharray={`${progress * 100} 100`}
          d="M12 130 Q260 -54 508 130"
        />
        <line className="arc-ground" x1="12" y1="134" x2="508" y2="134" />
      </svg>
      <div className="sun-times">
        <span>Sunrise {formatTime(weather.sunrise)}</span>
        <span>
          {daylightHours}h {daylightMinutes}m daylight
        </span>
        <span>Sunset {formatTime(weather.sunset)}</span>
      </div>
    </div>
  )
}

export function ForecastStrip({ weather }: { weather: WeatherEnvelope['data'] }) {
  return (
    <div className="forecast-strip" aria-label="Hourly forecast">
      {weather.hourly.map((hour) => (
        <div className="forecast-hour" key={hour.at}>
          <time className="meta" dateTime={hour.at}>
            {formatTime(hour.at)}
          </time>
          <strong>{formatTemperature(hour.temperature)}</strong>
          <em>{hour.condition}</em>
        </div>
      ))}
    </div>
  )
}

export function DawnWeather({ envelope }: { envelope: WeatherEnvelope }) {
  const weather = envelope.data
  return (
    <>
      <div className="temperature-lockup">
        <div className="temperature">{formatTemperature(weather.currentTemperature)}</div>
        <div className="weather-prose">
          <strong>{weather.condition}.</strong>
          <p>
            Feels{' '}
            {weather.apparentTemperature == null
              ? 'unavailable'
              : formatTemperature(weather.apparentTemperature)}{' '}
            · High {formatTemperature(weather.high)} · Low {formatTemperature(weather.low)}
            <br />
            {formatPercent(weather.precipitationProbability)} chance of rain
            {weather.windSpeed == null ? '' : ` · wind at ${Math.round(weather.windSpeed)}`}
          </p>
        </div>
      </div>
      <ForecastStrip weather={weather} />
      <dl className="weather-facts">
        <div>
          <dt>Feels like</dt>
          <dd>
            {weather.apparentTemperature == null
              ? '—'
              : formatTemperature(weather.apparentTemperature)}
          </dd>
        </div>
        <div>
          <dt>Precipitation</dt>
          <dd>{formatPercent(weather.precipitationProbability)}</dd>
        </div>
        <div>
          <dt>Sunrise</dt>
          <dd>{formatTime(weather.sunrise)}</dd>
        </div>
        <div>
          <dt>Sunset</dt>
          <dd>{formatTime(weather.sunset)}</dd>
        </div>
      </dl>
    </>
  )
}

export function DenseWeather({ envelope }: { envelope: WeatherEnvelope }) {
  const weather = envelope.data
  return (
    <>
      <div className="dense-wrap">
        <span className="dense-primary">{formatTemperature(weather.currentTemperature)}</span>
        <span className="dense-soft">{weather.condition.toLowerCase()}</span>
        <span className="dense-faint">H</span>
        <span className="dense-primary">{formatTemperature(weather.high)}</span>
        <span className="dense-faint">L</span>
        <span className="dense-primary">{formatTemperature(weather.low)}</span>
        <span className="dense-faint">rain {formatPercent(weather.precipitationProbability)}</span>
        <span className="dense-faint">
          feels{' '}
          {weather.apparentTemperature == null
            ? 'unavailable'
            : formatTemperature(weather.apparentTemperature)}
        </span>
        <span className="dense-faint">
          wind {weather.windSpeed == null ? 'unavailable' : Math.round(weather.windSpeed)}
        </span>
        <span className="dense-faint">
          <LocationProvenance envelope={envelope} />
        </span>
      </div>
      <div className="dense-wrap dense-forecast">
        {weather.hourly.map((hour) => (
          <span className="dense-hour" key={hour.at}>
            <time className="dense-faint" dateTime={hour.at}>
              {formatTime(hour.at, { hour12: false })}
            </time>{' '}
            {formatTemperature(hour.temperature)}
          </span>
        ))}
        <span className="dense-faint">sunrise {formatTime(weather.sunrise)}</span>
        <span className="dense-faint">sunset {formatTime(weather.sunset)}</span>
        <span className="dense-faint">
          daylight {Math.floor(weather.daylightMinutes / 60)}h {weather.daylightMinutes % 60}m
        </span>
      </div>
    </>
  )
}
