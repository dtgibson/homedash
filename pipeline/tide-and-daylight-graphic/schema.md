# Schema — Tide and Daylight Graphic

## Path

Incremental (extending the existing normalized source model). Homedash already owns four independent source envelopes, browser last-good snapshots, private environment configuration, Fastify source services, and Dawn/Dense renderers over one client state. This feature adds a fifth stateless source and no database, ORM model, durable server record, or migration.

## Current Schema State

### Application and persistence boundaries

| Owner | Cumulative durable state after this feature |
|---|---|
| Browser | `homedash.preferences.v1`, `homedash.location.v1`, and independently validated `homedash.cache.<source>.v1` snapshots for weather, bookmarks, eBird, llmdash, and tide. |
| Host | Private `.env`, the authoritative bookmark document selected by `BOOKMARKS_PATH`, and the existing systemd/Tailscale installation state. A fixed tide station remains an optional private override. |
| Fastify process | Independent weather, bookmark, eBird, llmdash, favicon, and tide caches plus last-good envelopes. Tide also keeps a bounded, one-day NOAA station-catalog cache. Every cache is bounded and replaceable on restart. |
| Upstream | Open-Meteo, SnowRaven/eBird, llmdash, eligible bookmark origins, and NOAA Tides & Currents remain authoritative for their own data. |

Dawn and Dense consume one normalized dashboard state. Appearance and view preferences remain browser-local. The host remains loopback-bound and Tailscale remains the authenticated HTTPS boundary. Exact coordinates and private upstream configuration do not enter browser URLs, responses, or logs.

The existing shared envelope remains version 1:

```ts
type WidgetEnvelope<T> = {
  schemaVersion: 1
  data: T
  issues: ApiIssue[]
  meta: {
    generatedAt: string
    sourceUpdatedAt: string | null
    freshness: 'fresh' | 'stale' | 'partial'
    location?: LocationProvenance
  }
}
```

Weather, bookmark, eBird, llmdash, preference, location, bookmark-document, favicon, launch, and moon-phase contracts remain as documented by the prior cumulative schema. Tide is additive and does not change their payloads or ownership.

### Private tide configuration

`server/config.ts` adds two environment values:

```ts
type TideConfig =
  | { mode: 'automatic' }
  | { mode: 'fixed'; stationId: string; stationLabel: string }
  | { mode: 'unavailable'; reason: 'invalid-station' | 'invalid-label' }
```

- A missing or blank `TIDE_STATION_ID` selects automatic mode. The resolved dashboard location chooses the nearest eligible station from NOAA's generic water-level station catalog.
- A nonblank `TIDE_STATION_ID` selects fixed mode and is valid only when it contains 1–16 ASCII letters or digits. It is sent only from the server to the fixed NOAA product API.
- `TIDE_STATION_LABEL` applies only to fixed mode. It is optional, trimmed, rejects control characters, contains 1–100 Unicode code points, and defaults to `Local tide` when a fixed ID exists. Automatic mode displays NOAA's validated public station name.
- Invalid override configuration does not prevent Homedash from starting. The tide endpoint returns its source-specific unavailable response; all other sources remain healthy.
- The browser submits only the same validated `LocationSelector` used by weather and eBird plus its IANA time zone. It never submits a station ID, provider URL, or datum.

The public installer may add empty private placeholders when these variables are absent, but it must preserve an existing `.env` and never commit a real station value.

### Provider boundary

The only tide provider origin is the code-owned NOAA origin. It exposes two fixed code-owned endpoints:

```text
https://api.tidesandcurrents.noaa.gov/api/prod/datagetter
https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=waterlevels
```

In automatic mode, `TideService` fetches the generic catalog without user coordinates, validates no more than 1,000 minimal entries, retains only active observed tidal stations with bounded IDs, names, and finite coordinates, and selects the smallest haversine distance locally. Empty, malformed, oversized, or unavailable catalogs fail only tide. The catalog body is capped at 1 MiB and cached for 24 hours; concurrent first loads coalesce.

For product data, `TideService` builds query parameters itself. The station comes from the validated automatic selection or fixed override; product, datum, units, time zone, application name, date range, interval, and format are fixed allowlisted values. Requests use `datum=MLLW`, `units=english`, `time_zone=gmt`, `format=json`, and the configured `UPSTREAM_TIMEOUT_MS`.

One load uses three bounded provider products:

1. `water_level` for recent six-minute observations.
2. `predictions` at the provider's six-minute interval for the curve.
3. `predictions` with `interval=hilo` for authoritative high/low turns.

The request window covers the current date minus one day through the current date plus two days in UTC. This deliberately over-fetches a bounded window so every browser time zone can select its local day and the next turn after a late-evening load without sending coordinates. Provider bodies are read with a 512 KiB cap before JSON parsing. Each parsed collection is capped at 1,000 points, ordered strictly by time, finite, and bounded to heights from -100 through 100 feet. Duplicate timestamps, invalid dates, impossible event ordering, provider error objects, HTML, redirects away from the fixed HTTPS origin, or excessive bodies fail closed.

### Normalized tide contracts

```ts
const tidePointSchema = z.object({
  at: z.iso.datetime(),
  heightFeet: z.number().finite().min(-100).max(100),
})

const tideTurnSchema = z.object({
  kind: z.enum(['high', 'low']),
  at: z.iso.datetime(),
  heightFeet: z.number().finite().min(-100).max(100),
})

const tideCurrentSchema = z.object({
  at: z.iso.datetime(),
  heightFeet: z.number().finite().min(-100).max(100),
  basis: z.enum(['observed', 'predicted']),
  direction: z.enum(['rising', 'falling', 'near-slack']),
})

const tideSummarySchema = z.object({
  station: z.object({
    label: z.string().min(1).max(100),
    datum: z.literal('MLLW'),
    units: z.literal('feet'),
  }),
  current: tideCurrentSchema,
  nextTurn: tideTurnSchema,
  predictions: z.array(tidePointSchema).min(2).max(600),
  turns: z.array(tideTurnSchema).min(1).max(16),
})

type TideEnvelope = WidgetEnvelope<TideSummary>
```

`stationId` is intentionally absent from the browser contract. The human label and datum provide honest provenance without exposing private configuration. `predictions` is the validated, downsampled visual series. It retains the first and last point, every 30-minute sample, the bracketing points around now, and every high/low event; output is strictly chronological and never exceeds 600 points.

### Current value and direction rules

At load time `now` is captured once and injected in tests.

1. Choose the newest observation with `at <= now` and age no greater than 60 minutes.
2. When one exists, `current` uses its height, time, and `basis: observed`.
3. Otherwise, find prediction points bracketing `now`, linearly interpolate the height, use `at: now`, and set `basis: predicted`.
4. For observed direction, compare the current observation with the newest distinct earlier observation at least six minutes older and no more than 60 minutes older. For predicted direction, compare the bracketing prediction points.
5. A height change of `>= 0.05` feet is `rising`; `<= -0.05` feet is `falling`; everything between is `near-slack`.
6. `nextTurn` is the first validated provider high/low event strictly after `now`. If no such event exists inside the bounded response, normalization fails rather than inventing one.

When observations fail but predictions and turns are valid, return a successful envelope with predicted `current`, `freshness: partial`, and one safe `upstream-unavailable` issue explaining that the current value is predicted. When prediction data or the next turn is unavailable, the load fails and follows last-good/error behavior because the graphic cannot meet its contract.

### Same-origin tide endpoint

```text
POST /api/tide
Content-Type: application/json
Body: {
  "location": {
    "kind": "current",
    "latitude": 37.77,
    "longitude": -122.30,
    "capturedAt": "2026-09-10T12:00:00.000Z"
  },
  "timeZone": "America/Los_Angeles"
}
```

The body is strict and contains the shared validated `LocationSelector` plus an IANA time-zone name of 1–80 characters. `resolveLocation` applies the same current, last-known, or Home rules as weather and eBird. The time zone selects the local-day slice; the resolved coordinates choose a station only inside the server and never enter an NOAA request. The route rejects query strings, unsupported content types, unknown fields, oversized bodies, invalid locations or time zones, and non-POST methods through the existing safe API error conventions.

Successful responses are `TideEnvelope`, `Cache-Control: no-store`, with the existing security headers. Provider and configuration failures return the same safe source-envelope pattern as other widgets: no upstream URLs, station IDs, provider fragments, stack traces, coordinates, or raw values are reflected.

`TideService.load(location, timeZone, force)` resolves a station, then returns prediction points spanning the requested time zone's current local midnight through the following local midnight, plus the first following high/low turn if it falls later. The `turns` array includes every event inside that graph window and the first later event. Date slicing uses validated ISO instants and an IANA time zone; daylight-saving days may contain 23 or 25 hours and are not forced to 24. The response `meta.location` contains only the existing provenance label/kind/timestamp, never coordinates.

### Cache and refresh state

The service keeps a 24-hour station-catalog cache plus two process-only product caches keyed by the selected station:

- Station catalog: one bounded validated entry, shared across automatic loads; fixed mode does not fetch it.
- Prediction/turn cache: successful normalized provider data, 60-minute TTL, bounded across selected stations.
- Observation cache: successful observations, 5-minute TTL, bounded across selected stations.

`force=true` bypasses product TTLs but does not redownload a fresh station catalog. Concurrent identical loads share one in-flight promise per cache. A prediction failure uses last-good data only for the same station and time zone; an observation-only failure can produce a partial predicted envelope. Cache keys contain the station ID only in process memory and never enter logs or responses.

The client adds:

```ts
type WidgetName = 'weather' | 'bookmarks' | 'ebird' | 'llmdash' | 'tide'
```

and registers `homedash.cache.tide.v1` with `tideEnvelopeSchema`. Tide participates in the existing `loading | ready | error` outer state plus `idle | refreshing | fresh | failed` refresh state, with the envelope's `fresh | partial | stale` data freshness. Snapshot parsing is fail-closed; an invalid snapshot is removed and never displayed.

Initial load resolves location once, then requests tide concurrently with weather and eBird using the same `LocationSelector` and the browser IANA time zone. Global refresh includes five sources and reports progress from 0 through 5. `retryWidget('tide')` requests only tide with the active selector. Location refresh reloads weather, eBird, and tide together so automatic selection follows the current fallback; fixed mode accepts but ignores the location for station choice.

### Renderer contract

Both renderers receive the same `WidgetState<TideEnvelope>`.

- Dawn's daylight region composes the existing solar arc, moon label, tide text, and one SVG tide plot. The curve uses `predictions`; a now/current marker uses `current`; turn markers use `turns`; sunrise/sunset markers use the weather envelope when present. Text names current height, basis, direction, next turn/time/height, station label, datum, and source freshness.
- Dense adds the same text meaning to its weather/daylight scan row and a compact SVG trace from the same points. It does not make a second request or reduce semantic content.
- Chart SVGs expose no essential content exclusively through geometry or color. One concise accessible summary is provided in text; decorative path details are `aria-hidden` to prevent duplicate output.
- Tide error/loading/partial notes occupy a fixed, bounded slot inside daylight context. They never replace weather, solar, or moon output.
- Both renderers select points against the same time domain, scale height from the visible prediction min/max with a nonzero padded range, and clamp markers inside the view box. Empty, constant, non-finite, or out-of-order series never reach rendering because the shared schema rejects them.

### Cumulative route and source inventory

After this feature the server retains health, static, weather, bookmarks, editable bookmark document, favicon, eBird, llmdash, and fixed launch routes, and adds only `POST /api/tide`. The generic NOAA catalog is a server-side dependency, not a browser route. CORS remains disabled; CSP remains same-origin for browser connections; the Kagi form remains the only allowed external form action. No database tables, migration files, service workers, WebSockets, analytics, accounts, or scheduled background jobs are added.

## Changes in This Feature

### Added

- Automatic nearest-station selection from the shared resolved dashboard location and a bounded, cached NOAA water-level catalog.
- Private fixed-station tide configuration as an optional override with a safe invalid state.
- Fixed NOAA provider adapter for observations, six-minute predictions, and high/low turns.
- Strict tide point, current, turn, summary, and envelope schemas.
- Deterministic observed/predicted fallback, direction classification, next-turn selection, local-day slicing, and downsampling.
- Independent bounded process caches, same-origin location-aware tide route, browser last-good snapshot, shared location/global refresh participation, and tide-only retry.
- Shared Dawn/Dense tide state plus accessible full and compact SVG presentations inside existing daylight context.

### Modified

- `DashboardData` and `WidgetName` gain additive `tide` state.
- Global refresh source count and accessible copy move from four to five.
- Location orchestration now refreshes weather, eBird, and tide from the same selector.
- The daylight presentation gains tide state without changing weather or moon ownership.
- The installer preserves existing private configuration and documents blank tide placeholders as automatic mode.

### Unchanged

- No existing envelope version, preference key, location key, weather contract, daylight calculation, moon-phase calculation, eBird contract, bookmark contract, llmdash contract, or persisted document changes.
- No browser coordinate is sent to NOAA and no browser value chooses a station or provider destination; station comparison happens locally in the Fastify process.
- No database, ORM, account, public listener, authentication layer, analytics, or production access by Codex is introduced.

## Migration Plan

1. Treat a blank tide station as automatic mode while retaining validation for fixed override IDs and labels.
2. Add a strict bounded NOAA station-catalog adapter, haversine nearest selection, one-day cache, and automatic/fixed selection tests.
3. Retain shared tide schemas and deterministic normalization helpers with fixtures for observed, predicted, partial, malformed, out-of-order, boundary, and daylight-saving cases.
4. Refactor the fixed-origin product adapter, product caches, and last-good state to use the selected station rather than global configuration.
5. Extend `POST /api/tide` with the shared location selector, strict time-zone validation, and safe errors.
6. Move tide into the client location-source orchestration, keeping snapshot hydration, tide-only retry, global refresh progress, and request mocks correct.
7. Retain the approved Dawn and Dense presentations over one normalized state; preserve weather, solar, and moon output in every tide state.
8. Update private installer guidance so blank station placeholders mean automatic selection without committing a real override.
9. Run focused service, contract, hook, component, accessibility, viewport, typecheck, and production-build checks before the release returns to The Deployer.

Rollback is additive: remove the tide route, client registration, presentation, and optional environment parsing. Existing `.env` keys can remain ignored, and all prior snapshots, source contracts, and durable bookmark data remain readable because none changed.

## Design Decisions

1. **Automatic selection reuses location already owned by Homedash.** The server compares that resolved location with a generic NOAA catalog and sends NOAA only its own selected station ID; a private fixed override handles cases where geometric proximity is not the preferred reference.
2. **NOAA remains authoritative.** Homedash normalizes provider observations and predictions but does not invent tidal science or store a competing history.
3. **Observed and predicted are explicit.** A predicted fallback keeps the day useful, but its label prevents false precision.
4. **Three provider products are worth the boundary.** Observations answer now, dense predictions draw the curve, and authoritative high/low predictions answer the next turn without fragile extrema inference.
5. **Tide is independent in data and combined in presentation.** Failure isolation follows Homedash's source rules; visual placement follows the user's one-glance goal.
6. **No schema migration is needed.** All new state is bounded cache or browser last-good data, not durable product data.
7. **Text owns meaning.** SVG makes the day's shape faster to read, while labeled values preserve accessibility and honest failure behavior.
8. **Local-day shape respects time zones.** The browser supplies the same bounded location selector used by weather plus an IANA time zone; station selection and provider destinations remain server-owned.
