# Schema — homedash v1

## Path

**Greenfield.** The repository contained approved planning and design artifacts but no application code, database schema, migrations, or ORM models to preserve.

## Overview

Homedash is a React/Vite/TypeScript web client served from a same-origin Fastify/Node server. It defaults to `127.0.0.1:1910` when run locally. A Raspberry Pi deployment binds explicitly to its private Tailscale address on port `1910`; public exposure is not supported.

The browser owns device preferences, location permission, the eligible last-known location, and last-successful widget snapshots. Fastify owns private configuration, upstream calls, normalization, validation, short-lived caches, and failure isolation. Dawn and Dense are two presentations over the same normalized widget state.

```text
Device browser
  └── Homedash Fastify server (:1910)
      ├── Open-Meteo
      ├── SnowRaven on the Pi ── eBird
      ├── llmdash
      └── bookmarks.json
```

Homedash has no persistent database, ORM, or migration layer. Durable state is limited to browser `localStorage`, host-side configuration, `bookmarks.json`, and the authoritative upstream systems. Fastify caches are memory-only and replaceable.

## Tables / Models

There are no database tables. The schema consists of shared TypeScript runtime contracts, configuration files, API routes, source adapters, and cache records. Runtime schemas validate configuration, local storage, route inputs, route outputs, and normalized upstream data; raw upstream payloads never become frontend state.

### Shared API Models

| Model               | Fields and rules                                                                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ApiIssue`          | Bounded issue code, safe user-facing message, and `retryable` boolean. Codes cover invalid configuration, missing credentials, timeout, rate limiting, upstream unavailability, invalid upstream payload, and partial data. |
| `ApiMeta`           | `generatedAt`, nullable `sourceUpdatedAt`, `fresh` or `stale`, `staleAfterMs`, issues, and optional location provenance. All timestamps are ISO-8601.                                                                       |
| `WidgetEnvelope<T>` | Schema version `1`, normalized widget data, and `ApiMeta`.                                                                                                                                                                  |
| `ApiErrorResponse`  | Schema version `1` plus a bounded code, safe message, and retryability. It never contains stack traces, raw upstream bodies, private addresses, or credentials.                                                             |
| `WidgetId`          | Initially `weather`, `bookmarks`, `ebird`, or `llmdash`.                                                                                                                                                                    |

### Browser-Owned Models

| Model                | Fields and rules                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DevicePreferences`  | Schema version `1`; display mode `dawn` or `dense`; appearance `system`, `light`, or `dark`. Missing or invalid data resolves to Dawn and System.              |
| `StoredLocation`     | Schema version `1`, latitude, longitude, and capture time. It is eligible for seven days and is retained only to support the approved location fallback.       |
| `LocationAttempt`    | Granted with a current location, denied, unavailable, or unsupported. This remains distinct from the location ultimately used for data.                        |
| `LocationSelector`   | Either current/last-known coordinates plus capture time, or a `home` sentinel resolved privately by Fastify.                                                   |
| `LocationProvenance` | `current`, `last-known`, or `home`, plus nullable capture time and age. Coordinates are never returned.                                                        |
| `WidgetSnapshot<T>`  | Schema version `1`, widget ID, save time, and a runtime-validated `WidgetEnvelope<T>`. Each widget is stored independently under `homedash.cache.<widget>.v1`. |

Preferences are stored at `homedash.preferences.v1`; last-known location is stored at `homedash.location.v1`. System appearance listens for device theme changes while the page is open.

### Private Host Configuration

| Area           | Fields and defaults                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Server         | Bind host defaults to `127.0.0.1`; port defaults to `1910`.                                              |
| Home location  | Nullable latitude and longitude, stored only in private configuration.                                   |
| Weather        | Temperature unit, initially Fahrenheit; Celsius remains host-configurable.                               |
| SnowRaven      | Fixed private base URL and request timeout. No upstream URL is accepted from a browser request.          |
| eBird behavior | User identity if required by the adapter, nearby window `14` days, radius `50` km, and target limit `5`. |
| llmdash        | Fixed private base URL, defaulting to `http://127.0.0.1:8787`.                                           |
| Bookmarks      | Path to the host-side `bookmarks.json`.                                                                  |

Private configuration is gitignored. Homedash does not store an eBird API key: SnowRaven remains responsible for eBird authentication.

### Weather Models

`WeatherSummary` contains:

- Temperature unit and selected location time zone.
- Current temperature, Open-Meteo weather code, and a bounded internal condition label.
- Today's high, low, and nullable precipitation probability.
- Sunrise, sunset, next daylight event, and its time.

Fastify requests Open-Meteo with the selected location and `timezone=auto`. Forecast periods and daylight are interpreted in that returned time zone.

### Bookmark Models

`bookmarks.json` remains the approved simple ordered array:

```json
[
  { "name": "GitHub", "url": "https://github.com" },
  { "name": "eBird", "url": "https://ebird.org" }
]
```

`BookmarkConfigEntry` contains `name` and `url`. `Bookmark` adds a deterministic internal ID and the array order. Only HTTP and HTTPS URLs are accepted. Invalid entries are omitted and counted without reflecting their contents to the client.

### SnowRaven Personal-Profile Adapter

SnowRaven is homedash's live adapter to the current personal eBird and Macaulay data held on the Pi. eBird remains authoritative underneath it.

The following SnowRaven endpoints are confirmed in the existing implementation:

| Confirmed endpoint          | Use                                                                     |
| --------------------------- | ----------------------------------------------------------------------- |
| `GET /health`               | Reachability check.                                                     |
| `GET /settings/files`       | Current eBird and Macaulay filenames and their `uploadedAt` timestamps. |
| `GET /settings/files/ebird` | Current My eBird Data CSV.                                              |
| `GET /settings/files/ml`    | Current Macaulay Library export.                                        |
| `POST /taxonomy/codes`      | Canonical eBird species-code lookup from common/scientific names.       |
| `GET /map/recent-obs`       | Recent nearby eBird observations grouped by species and locality.       |

SnowRaven's `/settings/keys` surface is explicitly excluded. Homedash never reads or manages SnowRaven credentials.

`SnowRavenProfileAdapter` is an internal homedash interface, not a presumed SnowRaven route. It exposes two operations:

- `loadPersonalProfile()` checks file metadata, streams and validates changed exports, canonicalizes taxa, and returns a compact profile snapshot.
- `loadNearby(location, radius)` validates and normalizes the existing recent-observation response.

`SnowRavenProfileSnapshot` contains:

- Source sync time from SnowRaven metadata.
- Canonical seen-species codes.
- Canonical species codes with photos.
- Canonical species codes with audio.
- Dated canonical observations needed for current and previous-year month counts.

Only this compact normalized snapshot remains in homedash memory. Raw CSV data is never written by homedash or delivered to the browser. Its freshness is anchored to SnowRaven's `uploadedAt`, never the time homedash downloaded it.

### eBird Models and Relationships

`EbirdTarget` contains canonical species code, common name, observation time, locality, and nullable distance. `EbirdSummary` contains lifer, photo, and audio target arrays; current and previous-year month counts; signed difference; nearby fetch time; and personal-profile sync time.

Classification uses canonical eBird species codes:

- A lifer is absent from the seen-species set.
- A photo target is absent from the photo-species set.
- An audio target is absent from the audio-species set.
- A species may appear in all three categories.

Reportable forms fold into their parent species. Hybrids, slashes, spuhs, and other non-countable taxa do not affect life or monthly totals.

SnowRaven's nearby endpoint uses a fixed 30-day upstream window, so homedash filters normalized observations to the configured 14-day window. Duplicate observations collapse to one result per species using shortest distance, then most recent date. Unknown distances sort last. Each category is independently capped at five.

Monthly comparison counts distinct canonical species from the first of the current month through today, then the same inclusive period one year earlier. February 29 clamps to February 28 where necessary. The viewing device's validated IANA time zone defines today; eBird observations retain their recorded local dates.

### llmdash Models

`LimitWindow` contains llmdash-supplied remaining percentage, nullable reset time, and capture time. `LlmProviderSummary` contains provider identity, label, nullable five-hour and weekly windows, and a bounded diagnostic code. `LlmdashSummary` contains independent Claude and Codex summaries plus llmdash's generation time.

Homedash reads only llmdash `/api/state`. It copies `remainingPct`, reset timestamps, capture times, and diagnostic state. Missing values remain unavailable; homedash never reconstructs them from used percentages or activity. Browser-local formatting converts reset times to the viewing device's time zone.

### Cache Models

`MemoryCacheRecord<T>` contains an internal key, normalized value, fetch time, expiry time, and stale-retention deadline. Location-dependent cache keys use the source, relevant non-secret settings, and an internal digest of rounded coordinates. Exact coordinates are not logged or persisted server-side.

| Source                       |       Request-cache period |       UI stale threshold |
| ---------------------------- | -------------------------: | -----------------------: |
| Open-Meteo                   |                 10 minutes |               30 minutes |
| SnowRaven metadata           |                 15 minutes |           Not applicable |
| SnowRaven normalized profile | Until `uploadedAt` changes | 6 hours from source sync |
| Nearby eBird observations    |                 15 minutes |                  6 hours |
| llmdash                      |                  5 seconds |               15 minutes |
| Bookmarks                    |     File modification time |       On a failed reread |

Concurrent identical cache misses share one in-flight request. Failed requests never become fresh entries. Last-good server or browser values may remain visible as stale with the current issue attached.

### Homedash Routes

| Route                      | Input                                                   | Responsibility                                                             |
| -------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| `GET /healthz`             | None                                                    | Report process health without exposing configuration or probing upstreams. |
| `POST /api/weather`        | `LocationSelector`                                      | Resolve location, call Open-Meteo, and return normalized weather/daylight. |
| `GET /api/bookmarks`       | None                                                    | Read and validate ordered bookmark configuration.                          |
| `POST /api/ebird/summary`  | `LocationSelector` plus validated device IANA time zone | Combine SnowRaven personal history and nearby observations.                |
| `GET /api/llmdash/summary` | None                                                    | Read and normalize authoritative llmdash state.                            |
| Static fallback            | None                                                    | Serve the Vite production build.                                           |

Manual refresh calls all four widget routes independently with `X-Homedash-Refresh: 1`. This bypasses homedash request caches without reloading the page or coupling source failures.

## Design Decisions

1. **One application process.** Fastify serves the Vite build and private API on port `1910`, simplifying local and Pi deployment.
2. **No database.** Every durable value already has an authoritative home; cached values are replaceable and carry freshness metadata.
3. **One data layer, two presentations.** Dawn and Dense consume identical widget envelopes and never implement source-specific fetching.
4. **Server-side source boundary.** The browser contacts only homedash. This protects private addresses and keeps upstream validation and error translation centralized.
5. **SnowRaven is the eBird adapter.** Homedash reuses its confirmed read-only data surfaces rather than duplicating eBird credentials or inventing an unconfirmed profile endpoint.
6. **Honest personal-data freshness.** The personal profile uses SnowRaven's source sync time. An old export remains visibly old even when fetched successfully today.
7. **Location privacy by construction.** Device coordinates use same-origin POST bodies, are excluded from logs and responses, and persist only for the approved browser fallback.
8. **Independent failure domains.** Every widget has its own route, state, cache, and retry lifecycle. Partial success remains usable.
9. **llmdash stays authoritative.** Homedash displays supplied quota values and never recomputes missing ones.
10. **Simple bookmark ownership.** File order is display order; no bookmark editor or database is introduced.
11. **Runtime validation at every boundary.** Malformed local, configured, or upstream data degrades one source without crashing the dashboard.
12. **Extensible widget registry.** Each widget registers its schema, loader, freshness policy, cached fallback, and two renderers. A future widget needs no central database migration.
13. **Private deployment default.** The server binds to loopback by default. Pi access binds explicitly to a Tailscale address; CORS remains disabled and public hosting is out of scope.

## Assumptions

- The SnowRaven Pi is privately reachable from the homedash host.
- SnowRaven's stored My eBird Data and Macaulay Library files are the current personal-history snapshot, and `uploadedAt` is their reliable sync time.
- SnowRaven remains responsible for eBird authentication and taxonomy refresh.
- The existing SnowRaven recent-observation route continues to accept a 1–200 km radius and return species/location observations from its fixed 30-day upstream window.
- llmdash is reachable at `http://127.0.0.1:8787` by default, with a private override for another tailnet host.
- Home coordinates are optional and remain in private deployment configuration.
- Fahrenheit is the initial host default; Celsius is configurable without changing the API schema.
- Homedash listens on port `1910` by explicit user decision.
