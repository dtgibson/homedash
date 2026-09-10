import type { WidgetState } from '../hooks/useDashboardData'
import { formatTime } from '../lib/format'
import { TIDE_PLOT_LEFT, TIDE_PLOT_RIGHT, tidePath, tideScaleModel } from '../lib/tideGeometry'
import type { TideEnvelope, TideTurn, WeatherEnvelope } from '../shared/contracts'
import { ErrorState, LoadingState, SourceFreshness } from './WidgetState'

const FULL_WIDTH = 520
const PLOT_TOP = 91
const PLOT_BOTTOM = 135

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function heightLabel(value: number) {
  return `${value.toFixed(1)} ft`
}

function turnLabel(turn: TideTurn) {
  return turn.kind === 'high' ? 'High' : 'Low'
}

function directionArrow(direction: TideEnvelope['data']['current']['direction']) {
  return direction === 'rising' ? '↑' : direction === 'falling' ? '↓' : '↔'
}

function compactSourceState(state: Extract<WidgetState<TideEnvelope>, { status: 'ready' }>) {
  if (state.refreshStatus === 'refreshing') return 'refreshing'
  if (state.refreshStatus === 'failed') return 'refresh failed'
  if (state.data.meta.freshness === 'stale') return 'stale'
  if (state.data.meta.freshness === 'partial' || state.data.meta.issues.length) return 'partial'
  return 'up to date'
}

function TideFacts({ envelope, compact = false }: { envelope: TideEnvelope; compact?: boolean }) {
  const { current, nextTurn, station } = envelope.data
  if (compact) {
    return (
      <p className="tide-facts-compact">
        <strong>{heightLabel(current.heightFeet)}</strong>
        <span aria-hidden="true">{directionArrow(current.direction)}</span>
        <span>
          · {nextTurn.kind} {formatTime(nextTurn.at)}
        </span>
      </p>
    )
  }
  return (
    <div className="tide-facts-full">
      <span>
        <strong>{heightLabel(current.heightFeet)}</strong> {current.basis} ·{' '}
        {current.direction.replace('-', ' ')}
      </span>
      <span className="tide-next">
        {turnLabel(nextTurn)} {heightLabel(nextTurn.heightFeet)} · {formatTime(nextTurn.at)}
      </span>
      <span className="tide-station">
        {station.label} · {station.datum}
      </span>
    </div>
  )
}

function TideSourceState({
  state,
  onRetry,
}: {
  state: WidgetState<TideEnvelope>
  onRetry: () => void
}) {
  return (
    <div
      className="tide-source-state"
      data-source="tide"
      data-refresh-state={state.status === 'ready' ? state.refreshStatus : state.status}
      aria-busy={
        state.status === 'loading' ||
        (state.status === 'ready' && state.refreshStatus === 'refreshing')
      }
    >
      <SourceFreshness source="tide" state={state} onRetry={onRetry} />
      {state.status === 'loading' && <LoadingState message="Reading the local tide…" />}
      {state.status === 'error' && (
        <ErrorState title="Tide is unavailable." message={state.message} onRetry={onRetry} />
      )}
    </div>
  )
}

function TideMarks({ envelope, compact = false }: { envelope: TideEnvelope; compact?: boolean }) {
  const width = compact ? 124 : FULL_WIDTH
  const top = compact ? 2 : PLOT_TOP
  const bottom = compact ? 20 : PLOT_BOTTOM
  const scale = tideScaleModel(envelope.data.predictions, width, top, bottom)
  const { current, nextTurn } = envelope.data
  return (
    <>
      <path className="tide-line" d={tidePath(envelope.data.predictions, width, top, bottom)} />
      {!compact && (
        <line
          className="tide-now-rule"
          x1={scale.x(envelope.meta.generatedAt)}
          x2={scale.x(envelope.meta.generatedAt)}
          y1="8"
          y2="140"
        />
      )}
      <circle
        className="tide-current-point"
        cx={scale.x(current.at)}
        cy={scale.y(current.heightFeet)}
        r={compact ? 2.5 : 5}
      />
      <circle
        className="tide-turn-point"
        cx={scale.x(nextTurn.at)}
        cy={scale.y(nextTurn.heightFeet)}
        r={compact ? 2 : 4}
      />
      {!compact && (
        <text
          className="coastal-label"
          x={scale.x(nextTurn.at)}
          y={Math.max(84, scale.y(nextTurn.heightFeet) - 9)}
          textAnchor="middle"
        >
          {nextTurn.kind}
        </text>
      )}
    </>
  )
}

export function TideTrace({ envelope }: { envelope: TideEnvelope }) {
  return (
    <svg className="dense-tide-trace" viewBox="0 0 124 22" aria-hidden="true">
      <TideMarks envelope={envelope} compact />
    </svg>
  )
}

export function CoastalDay({
  weather,
  tide,
  moonPhase,
  onRetry,
}: {
  weather: WeatherEnvelope | null
  tide: WidgetState<TideEnvelope>
  moonPhase: string | null
  onRetry: () => void
}) {
  const envelope = tide.status === 'ready' ? tide.data : null
  const model = envelope
    ? tideScaleModel(envelope.data.predictions, FULL_WIDTH, PLOT_TOP, PLOT_BOTTOM)
    : null
  const sunriseX = weather && model ? model.x(weather.data.sunrise) : null
  const sunsetX = weather && model ? model.x(weather.data.sunset) : null
  const solarStart = sunriseX ?? TIDE_PLOT_LEFT
  const solarEnd = sunsetX ?? TIDE_PLOT_RIGHT
  const solarProgress = weather
    ? clamp(
        (Date.parse(weather.meta.generatedAt) - Date.parse(weather.data.sunrise)) /
          Math.max(1, Date.parse(weather.data.sunset) - Date.parse(weather.data.sunrise)),
        0,
        1,
      )
    : 0
  const solarNow = solarStart + (solarEnd - solarStart) * solarProgress
  const solarNowY =
    76 * (1 - solarProgress) ** 2 -
    28 * (1 - solarProgress) * solarProgress +
    76 * solarProgress ** 2

  return (
    <div className="daylight-context coastal-day">
      <div
        className="coastal-graphic"
        aria-label={
          envelope
            ? `Current tide ${heightLabel(envelope.data.current.heightFeet)} ${envelope.data.current.basis}, ${envelope.data.current.direction.replace('-', ' ')}. Next ${envelope.data.nextTurn.kind} ${heightLabel(envelope.data.nextTurn.heightFeet)} at ${formatTime(envelope.data.nextTurn.at)}. ${envelope.data.station.label}, ${envelope.data.station.datum}.`
            : undefined
        }
      >
        <svg viewBox="0 0 520 150" aria-hidden="true">
          {weather && (
            <>
              <rect
                className="daylight-band"
                x={Math.min(solarStart, solarEnd)}
                y="8"
                width={Math.abs(solarEnd - solarStart)}
                height="128"
                rx="3"
              />
              <path
                className="coastal-sun-track"
                d={`M${solarStart} 76 Q${(solarStart + solarEnd) / 2} -14 ${solarEnd} 76`}
              />
              <path
                className="coastal-sun-progress"
                pathLength="100"
                strokeDasharray={`${solarProgress * 100} 100`}
                d={`M${solarStart} 76 Q${(solarStart + solarEnd) / 2} -14 ${solarEnd} 76`}
              />
              <line className="solar-rule" x1={solarStart} x2={solarStart} y1="8" y2="140" />
              <line className="solar-rule" x1={solarEnd} x2={solarEnd} y1="8" y2="140" />
              <circle className="sun-point" cx={solarNow} cy={solarNowY} r="3" />
            </>
          )}
          <line className="tide-axis" x1="12" x2="508" y1="137" y2="137" />
          {envelope ? (
            <TideMarks envelope={envelope} />
          ) : (
            <path className="tide-placeholder" d="M12 122 Q136 112 260 122 T508 122" />
          )}
        </svg>
        {weather && (
          <div className="sun-times coastal-sun-times">
            <span>Sunrise {formatTime(weather.data.sunrise)}</span>
            <span>
              {Math.floor(weather.data.daylightMinutes / 60)}h {weather.data.daylightMinutes % 60}m
            </span>
            <span>Sunset {formatTime(weather.data.sunset)}</span>
          </div>
        )}
        {envelope && (
          <>
            <TideFacts envelope={envelope} />
            <TideFacts envelope={envelope} compact />
          </>
        )}
        {moonPhase && (
          <p className="moon-phase">
            <span className="moon-phase-prefix">Moon</span>
            <span aria-hidden="true">·</span>
            <span className="moon-phase-label">{moonPhase}</span>
          </p>
        )}
      </div>
      <TideSourceState state={tide} onRetry={onRetry} />
    </div>
  )
}

export function DawnTideDetails({ state }: { state: WidgetState<TideEnvelope> }) {
  if (state.status !== 'ready') return null
  return (
    <div className="mobile-tide-details">
      <TideFacts envelope={state.data} />
      <span className="mobile-tide-source">
        Source time {formatTime(state.data.data.current.at)} ·{' '}
        {state.data.meta.freshness === 'partial' ? 'observation unavailable' : 'current'}
      </span>
    </div>
  )
}

export function DenseTide({
  state,
  onRetry,
}: {
  state: WidgetState<TideEnvelope>
  onRetry: () => void
}) {
  return (
    <div className="dense-tide-source" data-source="tide">
      <TideSourceState state={state} onRetry={onRetry} />
      {state.status === 'ready' && (
        <div
          className="dense-wrap dense-tide-line"
          aria-label={`Tide ${heightLabel(state.data.data.current.heightFeet)} ${state.data.data.current.basis}, ${state.data.data.current.direction.replace('-', ' ')}. Next ${state.data.data.nextTurn.kind} ${heightLabel(state.data.data.nextTurn.heightFeet)} at ${formatTime(state.data.data.nextTurn.at)}. ${state.data.data.station.label}, ${state.data.data.station.datum}.`}
        >
          <strong className="dense-primary">
            tide · {heightLabel(state.data.data.current.heightFeet)} {state.data.data.current.basis}
          </strong>
          <span className="dense-soft">{state.data.data.current.direction.replace('-', ' ')}</span>
          <span className="dense-tide-next">
            {state.data.data.nextTurn.kind} {heightLabel(state.data.data.nextTurn.heightFeet)} ·{' '}
            {formatTime(state.data.data.nextTurn.at)}
          </span>
          <span className="dense-faint">
            {state.data.data.station.label} · {state.data.data.station.datum}
          </span>
          <span className="dense-faint">source {formatTime(state.data.data.current.at)}</span>
          <span className="dense-faint">{compactSourceState(state)}</span>
          <TideTrace envelope={state.data} />
        </div>
      )}
    </div>
  )
}
