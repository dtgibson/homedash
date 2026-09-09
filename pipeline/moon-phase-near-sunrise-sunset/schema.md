# Schema — Moon Phase Near Sunrise and Sunset

## Path

**Frontend Only — no data-layer changes required.** The approved PRD derives one
qualitative value from the device's current wall-clock instant. It creates no
record, stored derived value, relationship, query, API field, route, upstream
request, cache, snapshot, source, or preference.

## Confirmation

This classification was checked against every user story and functional
requirement. Homedash has no database, ORM, or migration directory, and this
feature does not add one. The existing React/Vite browser remains the sole owner
of the calculation; the Fastify server and all shared network contracts remain
unchanged.

The prior schema artifacts document four version-1 widget envelopes and
device-local preferences, location, and widget snapshots. None needs a lunar
field. In particular, a valid pre-feature weather snapshot must continue to
hydrate without transformation.

## Existing Data Context

The phase does not read an application data model. Its only calculation input is
an epoch-millisecond value obtained from the device clock at evaluation time.
The existing weather model supplies neighboring daylight presentation only.

| Existing boundary | Existing values relevant to placement | Contract for this feature |
| --- | --- | --- |
| `WeatherEnvelope` / `WeatherSummary` | `sunrise`, `sunset`, `daylightMinutes`, `nextDaylightEvent`; `meta.generatedAt` and `meta.location` already support weather display | May remain visually adjacent, but none of these values is a phase-calculation input and no lunar field is added. |
| `POST /api/weather` | Existing normalized weather and daylight response | Continues unchanged. No moon request, response field, attribution, retry, or error behavior is added. |
| Other widget endpoints | `GET /api/bookmarks`, `POST /api/ebird/summary`, `GET /api/llmdash/summary` | Unchanged and never consulted by the phase calculation. |
| Browser storage | `homedash.preferences.v1`, `homedash.location.v1`, and the four `homedash.cache.*.v1` snapshot keys | No key, version, lunar snapshot, or migration is added. |

Weather location/time zone, sunrise and sunset dates, weather
`generatedAt`/`sourceUpdatedAt`, cache age, and location provenance are explicitly
not inputs. The browser's local time zone is used only to find the next local
calendar midnight for lifecycle re-evaluation.

## Shared Frontend Representation

Add a small pure module, `src/lib/moonPhase.ts`, with this public shape (names may
be adjusted mechanically, but the contract must remain equivalent):

```ts
export type MoonPhaseLabel =
  | 'New moon'
  | 'Waxing crescent'
  | 'First quarter'
  | 'Waxing gibbous'
  | 'Full moon'
  | 'Waning gibbous'
  | 'Last quarter'
  | 'Waning crescent'

export function classifyMoonPhasePosition(position: number): MoonPhaseLabel | null
export function deriveMoonPhase(atMs: number): MoonPhaseLabel | null
export function nextMoonPhaseBoundaryAt(atMs: number): number | null
```

`MoonPhaseLabel | null` is the entire value passed beyond the lifecycle owner.
Cycle fraction, lunar age, boundary timestamp, period constants, and calculation
details must not become view props, accessible descriptions, diagnostics, API
types, or stored values.

All three functions are total over JavaScript numbers: a non-finite input,
out-of-range classifier position, non-finite intermediate, or unavailable next
boundary returns `null`; it does not throw. `null` means omit the phase text and
any glyph. There is no `unknown` label, previous-value fallback, default phase,
or moon-specific error state.

## Deterministic Calculation

Use these fixed constants directly; no date parsing, locale rule, dependency, or
network data participates in the algorithm:

```text
reference epoch E = 947182440000 ms
                  = 2000-01-06T18:14:00.000Z
mean synodic month P = 29.530588853 days
                      = 2,551,442,876.8992 ms

cycles   = (atMs - E) / P
position = cycles - floor(cycles)
```

The floor-based normalization is required rather than JavaScript remainder so
dates before the epoch also land in `[0, 1)`. Reject any non-finite input or
intermediate before classification. This is a conventional mean-synodic-month
approximation calibrated to a fixed new-moon epoch; it supports a stable coarse
name and is not an ephemeris or an exact event prediction.

Map the normalized position with lower-inclusive, upper-exclusive comparisons:

| Normalized cycle position | Canonical label |
| --- | --- |
| `[15/16, 1)` or `[0, 1/16)` | `New moon` |
| `[1/16, 3/16)` | `Waxing crescent` |
| `[3/16, 5/16)` | `First quarter` |
| `[5/16, 7/16)` | `Waxing gibbous` |
| `[7/16, 9/16)` | `Full moon` |
| `[9/16, 11/16)` | `Waning gibbous` |
| `[11/16, 13/16)` | `Last quarter` |
| `[13/16, 15/16)` | `Waning crescent` |

Implement the wrap band explicitly and compare the odd-sixteenth thresholds in
ascending order. Do not use rounding to choose a label: exact thresholds belong
to the band beginning at that threshold.

### Reference-Fixture Proof

A read-only calculation probe using the constants and comparisons above produced
the following normalized positions and classifications:

| Approved UTC instant | Position | Result |
| --- | ---: | --- |
| `2024-04-08T18:21:00Z` | `0.994182480` | `New moon` |
| `2024-04-12T12:00:00Z` | `0.120675612` | `Waxing crescent` |
| `2024-04-15T19:13:00Z` | `0.232447662` | `First quarter` |
| `2024-04-19T12:00:00Z` | `0.357717956` | `Waxing gibbous` |
| `2024-04-23T23:49:00Z` | `0.509843643` | `Full moon` |
| `2024-04-27T12:00:00Z` | `0.628623492` | `Waning gibbous` |
| `2024-05-01T11:27:00Z` | `0.763300228` | `Last quarter` |
| `2024-05-05T00:00:00Z` | `0.882597432` | `Waning crescent` |

All eight approved fixtures pass. A direct classifier probe at each actual band
boundary (`1/16`, `3/16`, `5/16`, `7/16`, `9/16`, `11/16`, `13/16`, and
`15/16`) also confirms that a value immediately below selects the preceding
band, while the exact threshold and a value immediately above select the new
band. Values immediately below and above the `0/1` wrap both remain `New moon`.

## Ownership and Data Flow

One hook, `src/hooks/useMoonPhase.ts`, owns the current result and every lunar
lifecycle concern. `App` calls it once above the Dawn/Dense mode fork and passes
the same `MoonPhaseLabel | null` down to the active presentation. Neither view,
`SunArc`, nor `DenseWeather` may call `Date.now`, normalize a cycle, classify a
phase, keep a second phase state, or infer a label from a glyph.

```text
device epoch milliseconds
  -> pure deriveMoonPhase
  -> useMoonPhase (single state + scheduler)
  -> App
  -> Dawn daylight context OR Dense weather/daylight context
```

The label must be rendered independently of `WeatherEnvelope` availability so it
survives loading, stale, refreshing, partial, and weather-error states. Dawn may
place it in the masthead's existing daylight treatment, and Dense may place it
in the existing weather/daylight content, but both consume the same prop. The
canonical visible text is the accessible meaning. Any duplicate glyph is
derived only from that label and receives `aria-hidden="true"`.

## Lifecycle and Scheduling

The hook performs one lazy initial evaluation and exposes a stable
`reevaluate()` callback for existing refresh boundaries. It owns one scheduled
timeout at a time, targeting the earlier of:

1. the next qualitative band boundary computed from the same epoch and period;
2. the next browser-local midnight, computed with calendar operations such as a
   copied `Date` followed by `setHours(24, 0, 0, 0)` so DST transitions are not
   treated as fixed 24-hour days.

The next band boundary must be strictly later than `atMs`; choose the next
odd-sixteenth threshold in the current cycle or `1/16` in the next cycle after
the `15/16` threshold, and round the scheduled epoch up to the next integer
millisecond. When the timeout runs, derive from a fresh device instant and
replace the timeout using newly computed deadlines. A callback that runs early,
late, or after a wall-clock jump therefore re-arms from observed time rather
than advancing a remembered phase.

Register one `visibilitychange` listener. When the document becomes hidden,
clear the timeout. When it becomes visible, evaluate from a fresh device instant
and schedule again; this catches suspended tabs that passed either deadline.
`App` also calls `reevaluate()` in `finally` after the existing global refresh,
weather retry, and location retry promises settle, regardless of success or
failure. Those calls do not add phase work to `useDashboardData`, do not count as
a source, and do not contend with network refreshes.

Use a functional state update and preserve the current state object when the
new label is identical. On an invalid result, replace any previous label with
`null`. Every evaluation cancels the prior timeout before re-arming. Effect
cleanup removes the visibility listener, clears the timeout, and prevents a
queued callback from updating after unmount or React Strict Mode effect replay.
An invalid clock leaves no timer running but may recover on a later visibility
or refresh-settlement evaluation.

There is no interval, seconds/minutes tick, animation timer, background worker,
network request, prefetch, or moon-specific refresh/retry control.

## File-Level Implementation Plan

| File | Minimal responsibility |
| --- | --- |
| `src/lib/moonPhase.ts` | Own the string union, constants, normalization, exact band mapping, safe derivation, and next-boundary calculation. |
| `src/lib/moonPhase.test.ts` | Prove all eight approved dates, every lower-inclusive threshold and wrap, invalid/non-finite behavior, negative-cycle normalization, and strictly-future boundary selection. |
| `src/hooks/useMoonPhase.ts` | Own the one shared label, earliest-deadline timeout, local-midnight calculation, visibility handling, refresh-settlement entry point, state de-duplication, and cleanup. |
| `src/hooks/useMoonPhase.test.tsx` | Use fake timers and a controlled system clock to prove initial, boundary, local-midnight, hidden/resume, early/late timer, unchanged-label, invalid-clock, and unmount behavior without live data. |
| `src/App.tsx` | Instantiate the hook once, pass its label through the mode fork, and invoke its stable re-evaluation callback after existing global/weather/location refresh settlements. Preserve all source/progress logic. |
| `src/components/DawnView.tsx` | Accept the shared nullable label and place canonical text in the existing daylight treatment even when weather is not ready. Do not calculate or store phase state. |
| `src/components/DenseView.tsx` | Accept the same nullable label and place canonical text in the existing weather/daylight reading order even when weather is not ready. Keep the established row count. |
| `src/components/Weather.tsx` | If a shared presentational fragment is useful, render only the passed canonical label and optional hidden duplicate glyph; leave all sun/daylight calculations unchanged. |
| `src/App.test.tsx` and `tests/e2e/dashboard.spec.ts` | Cover mode/appearance parity, weather-state independence, omission on `null`, authoritative accessible text, unchanged four-source behavior, and required viewport/overflow regressions. |
| `src/styles.css` / `src/single-screen.css` | Apply only the Designer-approved compact treatment and responsive fit; add no card, row, source region, scroll container, or required motion. |

No server file, shared API contract, storage module, environment file, install
script, CSP, or infrastructure artifact should change for this feature.

## Integration Boundaries and Risks

- **Clock and floating-point boundaries:** classify direct normalized test inputs
  at exact thresholds, schedule using a strictly future rounded-up millisecond,
  and recompute from fresh time after every wake-up. Never select a phase by
  rounding the position.
- **Stale contradictory UI:** one App-owned nullable label is the only lunar
  state. Invalid evaluation clears it, and renderers never retain or derive a
  fallback.
- **Weather coupling:** the phase prop exists outside ready-only weather
  branches. Weather failures cannot suppress it, and phase failures cannot
  suppress or alter daylight/weather content.
- **Lifecycle leaks or churn:** one replaceable timeout, one visibility listener,
  strict cleanup, and equality-preserving state updates bound the work.
- **Precision overclaim:** expose only canonical text. Never render the internal
  fraction, age, angle, boundary time, countdown, illumination, visibility, or
  ephemeris language.
- **Layout regression:** placement reuses existing daylight content; mobile and
  desktop overflow checks remain release conditions in both modes and all
  appearances.
- **Contract and privacy drift:** do not touch coordinates, location selectors or
  provenance, Open-Meteo attribution, route shapes, cache keys, source status,
  CSP, private configuration, logs, or telemetry.

## Migrations and Compatibility

**Migrations: none.** There is no database migration, API/schema-version change,
browser-storage migration, cache invalidation, environment/configuration change,
server rollout, or infrastructure change. Existing cached envelopes remain
valid as-is. Rollback removes the frontend utility, hook, presentation props,
and styles without transforming retained data.

## Architecture Acceptance Checks

- Pure calculation tests pass for all eight reference dates, all actual band
  boundaries and wraparound, invalid values, and pre-epoch instants.
- Fake-timer lifecycle tests prove initial evaluation, strictly scheduled band
  and local-date updates, visibility recovery, refresh-settlement evaluation,
  cleanup, and no seconds/minutes polling or unchanged-label churn.
- Dawn and Dense expose the identical canonical label for one controlled instant
  in System, Light, and Dark, while `null` omits all lunar output.
- The label remains present through weather loading, cached stale, refreshing,
  failed-with-saved-value, partial, and unavailable states without being counted
  or attributed as weather.
- Existing route, contract, snapshot hydration, source isolation, progress,
  provenance, daylight calculation, preference, launch/search, focus, keyboard,
  touch, CSP, and security tests remain unchanged and green.
- The approved 1440×900 and 360×800 viewport matrix retains one-screen fit for
  normal payloads and only established source-owned bounded overflow elsewhere.
