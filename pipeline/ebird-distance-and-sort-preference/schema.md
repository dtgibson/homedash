# Schema — eBird Distance and Sort Preference

## Path

Incremental (extending the existing normalized eBird source and browser-owned preference record). Homedash already has a Fastify eBird adapter over SnowRaven, strict shared envelopes, source-local caches, per-browser preference and snapshot storage, and two renderers over one client state. This feature adds no database, ORM model, durable server record, or migration.

## Current Schema State

### Application and persistence boundaries

| Owner | Cumulative durable state after this feature |
|---|---|
| Browser | `homedash.preferences.v1` with view, appearance, and target order; `homedash.location.v1`; and independently validated `homedash.cache.<source>.v1` snapshots for weather, bookmarks, eBird, llmdash, and tide. |
| Host | Private `.env`, the ordered bookmark document selected by `BOOKMARKS_PATH`, and the existing systemd/Tailscale installation state. eBird radius remains private environment configuration. |
| Fastify process | Independent bounded weather, bookmark, eBird, llmdash, favicon, and tide caches plus last-good envelopes. Nothing survives process restart. |
| Upstream | SnowRaven/eBird remains authoritative for bird observations, personal history, and media history; the other existing upstream authorities remain unchanged. |

The tailnet remains the authenticated boundary. Browser preferences never leave the device. Exact device/Home coordinates and private upstream configuration do not enter browser URLs, logs, or preference payloads. There is still no database.

### Shared envelope

All five dynamic sources retain the version-1 normalized wrapper:

```ts
type WidgetEnvelope<T> = {
  schemaVersion: 1
  data: T
  meta: {
    generatedAt: string
    sourceUpdatedAt: string | null
    freshness: 'fresh' | 'partial' | 'stale'
    staleAfterMs: number
    issues: ApiIssue[]
    location?: LocationProvenance
  }
}
```

Weather, bookmarks, llmdash, and tide retain their current cumulative contracts. eBird continues to carry monthly comparison, target availability, profile/source timestamps, radius, window, and location provenance.

### Browser preferences

The existing preference key and schema version stay stable. One additive field is parsed with a field-local fallback so a missing or invalid target order never discards an otherwise valid saved mode and appearance:

```ts
const targetSortSchema = z.enum(['distance', 'recent'])

const preferencesSchema = z.object({
  schemaVersion: z.literal(1),
  mode: z.enum(['dawn', 'dense']),
  appearance: z.enum(['system', 'light', 'dark']),
  targetSort: targetSortSchema.catch('distance').default('distance'),
})

type DevicePreferences = {
  schemaVersion: 1
  mode: 'dawn' | 'dense'
  appearance: 'system' | 'light' | 'dark'
  targetSort: 'distance' | 'recent'
}
```

`DEFAULT_PREFERENCES.targetSort` is `distance`. `usePreferences` keeps its existing optimistic in-memory behavior: a rejected `localStorage` write returns `false`, but the current visit retains the selected value and announces that it was not saved. Category remains session-only state and is not added to this contract.

### eBird target contract

The normalized target record is unchanged:

```ts
type EbirdTarget = {
  speciesCode: string
  commonName: string
  observedAt: string // validated ISO instant
  locality: string
  distanceKm: number | null
}
```

Define one reusable, strict, bounded category set:

```ts
const ebirdTargetSetSchema = z.object({
  lifer: z.array(ebirdTargetSchema).max(5),
  photo: z.array(ebirdTargetSchema).max(5),
  audio: z.array(ebirdTargetSchema).max(5),
}).strict()
```

Extend `EbirdSummary` additively:

```ts
type EbirdSummary = {
  radiusKm: number
  windowDays: number
  targets: EbirdTargetSet          // nearest-first compatibility projection
  targetOrders: {
    distance: EbirdTargetSet
    recent: EbirdTargetSet
  }
  targetAvailability: {
    lifer: boolean
    photo: boolean
    audio: boolean
  }
  month: MonthComparison
  nearbyUpdatedAt: string
  profileUpdatedAt: string
}
```

`targets` remains present and equals `targetOrders.distance`; this avoids rewriting the established eBird contract while Dawn and Dense move to `targetOrders[preferences.targetSort]`. `targetOrders` is required on a newly validated envelope. A legacy cached eBird envelope without it is safely ignored on the first post-update paint and replaced by the live response; it is never treated as a complete recency data set.

At most 30 serialized target entries are present across the compatibility projection and two orders. Every list is independently bounded to five and every target passes the existing strict public contract before the envelope is cached, stored, or rendered.

### Deterministic ordering and deduplication

`classifyTargetCategories` receives the complete validated nearby pool and produces both orders before applying the existing per-category limit. It filters each category from the same pool and uses one parameterized `dedupeSortTargets(targets, order)` path.

For `distance`:

1. A finite known `distanceKm` sorts before `null`, ascending.
2. Equal distances sort by `observedAt` descending.
3. Equal records sort by `speciesCode`, then `locality`, then `commonName`, ascending by code point.
4. Duplicate species retain the first record under those rules.

For `recent`:

1. `observedAt` sorts descending.
2. Equal times use finite known `distanceKm` before `null`, ascending.
3. Equal records sort by `speciesCode`, then `locality`, then `commonName`, ascending by code point.
4. Duplicate species retain the first record under those rules.

Deduplication is performed with the selected comparator before category filtering and slicing. The final stable fields make output independent of provider row order. Because `observedAt` is already an ISO instant and distance is finite/nonnegative or null at this boundary, neither comparator invents fallback user data.

### Source load, cache, and refresh behavior

`EbirdService.load` continues to load the profile and one nearby pool concurrently. It classifies that pool twice in memory, once per allowed order, without another SnowRaven request. Its last-good envelope and cache key remain location/time-zone owned rather than preference owned because each envelope contains both orders.

The client continues to validate and save one eBird envelope. A sort change selects a different bounded projection synchronously from the current ready state; it does not call `load`, alter source freshness, enter a loading state, or touch global refresh progress. Initial load, global refresh, location refresh, and eBird-only retry each fetch one envelope containing both orders and preserve the current browser preference.

### Radius configuration and installer migration

`EBIRD_RADIUS_KM` remains an integer from 1 through 200. Its schema default, `.env.example`, and new installer-created `.env` value change from `50` to `16`, which is 9.94 miles and displays as `10 mi` under the existing formatter.

For an existing `.env`, the installer performs one narrow content-preserving migration only when a complete line is exactly:

```text
EBIRD_RADIUS_KM=50
```

It replaces that line with `EBIRD_RADIUS_KM=16` and leaves every other byte and the existing file mode intact. Whitespace variants, comments, duplicates, missing keys, and every other numeric value are treated as deliberate host state and preserved. The installer reports the managed-default update without printing coordinates or unrelated values.

The browser still receives the normalized `radiusKm` for honest display, but it cannot choose the SnowRaven radius. SnowRaven receives the server-owned radius with the same private resolved coordinates and fixed internal destination as before.

## Changes in This Feature

### Added

- `targetSortSchema` and `DevicePreferences.targetSort`, defaulting field-locally to `distance` under the existing schema version and storage key.
- `EbirdSummary.targetOrders.distance` and `.recent`, each a strict category set capped at five.
- A deterministic recency comparator and stable final tie-breakers shared by sort-aware deduplication and ordering.
- A narrow installer migration from the exact prior managed radius line to the new ten-mile-equivalent line.

### Modified

- `EBIRD_RADIUS_KM` default and public/new-install value: `50` km → `16` km, because the standard useful area is ten miles.
- `EbirdSummary.targets` gains an explicit maximum of five per category and remains the distance-first compatibility projection.
- eBird normalization now derives both complete ordered projections from one upstream pool before applying the result cap.
- Dawn/Dense target selection now combines the shared envelope with the shared browser preference; source fetching remains unchanged.

### Unchanged

- The `EbirdTarget` fields, source envelope version, location provenance, monthly comparison, availability flags, freshness, and last-good behavior.
- SnowRaven routes, resolved private location input, 14-day observation window, five-target display cap, map-launch allowlist, and eBird/profile authority.
- Weather, bookmark, llmdash, tide, location, and bookmark-document contracts and storage.
- No database, server preference, cross-device sync, source request on sort change, or new upstream call.

## Migration Plan

1. Add the target-sort enum and field-local preference fallback; update defaults and tests proving old/invalid sort values retain valid mode and appearance.
2. Add strict bounded target-set and two-order eBird response schemas while retaining `targets` as the nearest compatibility projection.
3. Generalize target comparison/deduplication by validated order, including deterministic exact-tie handling, and build both capped category sets from the complete nearby pool.
4. Return both orders from the existing one-load eBird service without changing its cache key or upstream request count.
5. Wire the shared preference and selected projection through App, Dawn, Dense, and the accessible sort control; verify a toggle performs no request and keeps category/focus.
6. Change the standard server/example/new-install radius to `16` and add the exact-line `50` → `16` updater migration with preservation tests.
7. Update unit, integration, saved-state, renderer, accessibility, and 1440×900/360×800 browser matrix coverage; rerun the full project, production build, installer, and design checks.

Rollback is additive: remove the order control and preference field, read the retained `targets` distance projection, and restore the default radius if desired. Existing private `.env` values and eBird snapshots remain replaceable host/browser state; no durable database migration needs reversal.

## Design Decisions

1. **Both orders travel together.** A single bounded envelope makes sorting immediate, local, and available during saved-first or failed-refresh states without coupling a presentation preference to source lifecycle.
2. **The existing projection stays.** Keeping `targets` as nearest-first makes the contract extension additive and leaves a clean rollback path while new renderers use `targetOrders`.
3. **The full pool precedes the cap.** Sorting five already-nearest results would make `Recent` misleading; each comparator owns deduplication and selection before slicing.
4. **One local preference owns both renderers.** This extends the existing device-owned presentation model and prevents category or view changes from changing the chosen meaning.
5. **The radius migration is surgical.** Standard installs should receive the requested ten-mile area, but a non-default host value is a deliberate private decision and remains untouched.
6. **No source boundary changes.** SnowRaven remains authoritative, resolved coordinates remain server-side, and one upstream nearby request supplies both local presentations.

