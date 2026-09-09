# Schema — Clickable Dashboard and Kagi Search

## Path

**Frontend Only (data-layer classification).** This feature does not add or migrate a database, durable model, widget envelope, upstream adapter, or browser-storage schema. The existing React/Vite client and same-origin Fastify server remain the complete application boundary. Implementation adds fixed server launch endpoints and one private host configuration value, but those are navigation/configuration concerns rather than a new data layer.

The approved `EbirdSummary`, `EbirdTarget`, and `LlmdashSummary` contracts already contain every value the presentations need. In particular, canonical `speciesCode`, `distanceKm`, and `radiusKm` remain authoritative and retain their current names and units.

## Existing Architecture and Contracts

Homedash remains one React application served by one Fastify process on loopback port `1910`, with Tailscale providing the private HTTPS listener. Dawn and Dense remain alternate presentations over the same normalized widget state.

```text
Browser
  ├── GET /launch/ebird/my-ebird ─────── 302 to fixed My eBird URL
  ├── GET /launch/ebird/map/:speciesCode 302 to fixed eBird map base + validated code
  ├── GET /launch/llmdash ────────────── 302 to private, server-owned launch setting
  ├── GET https://kagi.com/search?q=… ── deliberate native form navigation
  └── Existing same-origin widget API
      ├── POST /api/weather
      ├── GET  /api/bookmarks
      ├── POST /api/ebird/summary
      └── GET  /api/llmdash/summary
```

No launch destination is added to an API response, widget envelope, hydration payload, generated client bundle, local storage, or diagnostic message. A configured private llmdash destination is disclosed to the browser only as the unavoidable `Location` response to an explicit activation of its fixed launch route.

### Unchanged Shared API Models

| Model | Contract retained by this feature |
| --- | --- |
| `WidgetEnvelope<T>` | `schemaVersion: 1`, normalized `data`, and `ApiMeta`; no version increment. |
| `EbirdTarget` | `speciesCode`, `commonName`, `observedAt`, `locality`, and nullable `distanceKm`; no destination URL and no miles field are added. |
| `EbirdSummary` | Existing `radiusKm`, `windowDays`, target collections and availability, month comparison, and source timestamps remain unchanged. |
| `LlmdashSummary` | Existing provider windows and generation time remain unchanged; the launch destination is not part of this model. |
| `ApiErrorResponse` | Existing safe versioned error shape is reused for non-redirecting launch failures. It must not contain a rejected identifier, raw setting, private hostname, or stack trace. |
| `DevicePreferences` / `WidgetSnapshot<T>` | Existing storage keys and schema versions remain unchanged. Search text and launch configuration are never stored in either model. |

The eBird service continues to request SnowRaven with `EBIRD_RADIUS_KM`, cache and compare `distanceKm`, deduplicate by canonical species code, order by shortest kilometer distance then recency, and cap each category as it does today. Miles exist only in browser presentation formatting.

## New Private Configuration Boundary

Add `LLMDASH_LAUNCH_URL` as a setting separate from the existing `LLMDASH_URL`.

| Setting | Ownership | Validation and behavior |
| --- | --- | --- |
| `LLMDASH_URL` | Existing private server setting | Unchanged. This remains the server-to-server data source used only by `GET /api/llmdash/summary`. It must never be inferred as the launch destination. |
| `LLMDASH_LAUNCH_URL` | New private server setting | Optional at process startup. When supplied, it must parse as an absolute URL whose protocol is exactly `http:` or `https:` and whose hostname is non-empty. Reject credentials and fragments. Preserve an intentional path and query. There is no checked-in real default. |

Configuration parsing must isolate a missing or malformed launch setting instead of preventing the rest of homedash from starting. Represent the result internally as a non-exported discriminated value such as:

```ts
type LlmdashLaunchDestination =
  | { status: 'ready'; url: URL }
  | { status: 'unavailable'; reason: 'missing' | 'invalid' }
```

The raw value and parsed URL remain server-only. The unavailable variant supports safe, deterministic route behavior without coupling launch readiness to llmdash data loading or to any other widget.

Public `.env.example` and deployment instructions include `LLMDASH_LAUNCH_URL=` or a clearly non-sensitive placeholder. Fresh installs may populate it only from an explicitly supplied host environment value. Updates preserve an existing private value byte-for-byte and never replace it with the example or derive it from `LLMDASH_URL`. A missing value after update is documented as an explicit deployment action, not guessed from a hostname.

## Fixed Launch Route Contracts

All launch actions are `GET` routes registered before the static client fallback. They accept no body, no caller-selected destination, and no `url`, `next`, `redirect`, or equivalent query parameter. Successful responses use an ordinary temporary same-tab redirect (`302` with `Location`) and `Cache-Control: no-store`.

| Route | Accepted input | Destination assembly | Failure behavior |
| --- | --- | --- | --- |
| `GET /launch/ebird/my-ebird` | None | Exact server constant `https://ebird.org/myebird` | No configuration dependency. Unsupported methods receive a non-redirecting `404` or `405`. |
| `GET /launch/ebird/map/:speciesCode` | One decoded path segment matching `^[a-z0-9]{3,24}$` | Append the validated identifier as one encoded segment beneath the exact base `https://ebird.org/map/`. No other target field participates. | Missing, malformed, slash-bearing, URL-like, overlong, or otherwise invalid input receives a non-redirecting `400` using the safe error shape. |
| `GET /launch/llmdash` | None | The ready `LLMDASH_LAUNCH_URL` parsed at startup | Missing configuration returns non-redirecting `503` with `missing-configuration`; invalid configuration returns non-redirecting `503` with `invalid-configuration`. llmdash data-source health is not checked. |

The species-map route validator is intentionally stricter than general display text. It accepts the canonical lowercase ASCII alphanumeric identifier already carried by each normalized target and cannot parse a scheme, authority, separator, traversal sequence, percent-encoded slash, or absolute URL. Destination construction uses the URL API plus an encoded single segment rather than string interpolation with untrusted text.

The client builds only same-origin route paths:

- My eBird: `/launch/ebird/my-ebird`
- Species map: `/launch/ebird/map/${encodeURIComponent(target.speciesCode)}`
- llmdash: `/launch/llmdash`

These are semantic `<a>` elements without `target`, scripted popup behavior, iframe embedding, or download attributes. The llmdash anchor is part of the source identity in both presentations regardless of whether widget data is loading, ready, stale, partial, or unavailable. Its existence does not depend on a destination-readiness API call; a bad host setting fails only after explicit navigation at the server route.

The SPA fallback must exclude both `/api/` and `/launch/`. Unknown or incomplete launch paths therefore return a non-redirecting error instead of `index.html`. Launch routes do not participate in widget refresh, caches, stale snapshots, or service health checks.

## Kagi Search Contract

The search form belongs in the existing shared `Toolbar`, above the Dawn/Dense presentation fork, so there is one DOM form and one ephemeral query value per mounted document. It is not a widget or source and has no homedash API route.

- Use a semantic `GET` form whose action is the fixed public URL `https://kagi.com/search` and whose text input is named `q`.
- On submit, trim surrounding whitespace. Prevent submission when the result is empty; otherwise submit the trimmed value through the browser's native form encoding and normal same-tab navigation.
- Keep the input value only in the mounted form. Do not put it in preferences, local storage, snapshots, URL state, telemetry, logs, fetch calls, preconnects, or prefetches.
- Focus the input once after the initial application mount. Guard the effect with a mount-lifetime ref so React effect replays, mode/appearance changes, refreshes, location retries, category changes, and asynchronous widget updates cannot reclaim focus.
- Preserve a persistent Kagi-specific accessible name, an explicit submit control, native Enter behavior, logical focus order, and visible focus treatment.

Because the native form submits directly to Kagi, update only the CSP `form-action` source from `'none'` to the exact Kagi search action (`https://kagi.com/search`). Keep `default-src`, `connect-src`, `script-src`, `frame-src`/frame restrictions, `object-src`, and every unrelated directive at least as restrictive as today. Search requires no `connect-src` allowance and no API key.

## Miles Presentation Boundary

Add one shared presentation helper in `src/lib/format.ts` and use it everywhere Dawn or Dense renders an eBird distance or radius. The computation is:

```text
miles = kilometers × 0.621371
```

Formatting is decided from the converted miles value:

- nullable target distance: `distance unknown`
- below `10 mi`: one fractional digit, including zero (`0.0 mi`)
- at or above `10 mi`: nearest integer (`31 mi` for the default `50 km` radius)

The formatter may expose distance and radius wrappers for copy differences, but both must call the same conversion/rounding primitive. Dawn and Dense must not independently convert or round. Weather units are unrelated and remain unchanged.

No server request, normalized value, cache key, target membership, ordering rule, tie-breaker, or TypeScript field changes from kilometers. Tests should assert both the rendered miles and the unchanged kilometer payload/order from controlled fixtures.

## Component and Ownership Map

| Area | Implementation boundary |
| --- | --- |
| `server/config.ts` | Parse `LLMDASH_LAUNCH_URL` into the isolated server-only ready/unavailable value while leaving `LLMDASH_URL` behavior intact. |
| `server/app.ts` | Register the three exact launch routes, safe errors, no-store redirects, CSP adjustment, and `/launch/` fallback exclusion. Route logic may be extracted to a small server-only launch module. |
| `src/components/Toolbar.tsx` | Own the single Kagi form, trim/empty guard, initial-focus-once behavior, accessible label, and submit control. |
| `src/components/Targets.tsx` | Render the existing common-name content as the species-map anchor using `speciesCode` only; keep distance/locality/time display semantics. |
| `src/components/DawnView.tsx` and `DenseView.tsx` | Attach My eBird to month context and llmdash launch to source identity in every data state; replace radius copy with the shared miles formatter. |
| `src/lib/format.ts` | Own the sole kilometer-to-statute-mile conversion and rounding behavior for eBird UI. |
| `.env.example`, installer/update flow, deployment docs | Describe the new private setting without a real hostname and preserve existing private values during updates. |

## Security, Privacy, and Failure Isolation

1. **No open redirect.** Route identity selects the destination class. The browser can provide only a strictly bounded species code, never a URL or host.
2. **Private launch URL stays server-owned.** It is absent from source assets and dashboard responses. Do not log the raw setting, resolved destination, redirect header, or rejected path input.
3. **Deliberate outbound traffic only.** Search transmits a query only after submit. Launch endpoints resolve only after anchor activation. There are no readiness probes, prefetches, suggestions, or background destination lookups.
4. **Source isolation.** A launch setting failure does not alter `LlmdashService`, widget fetch state, health reporting, refresh orchestration, or any other response. Conversely, llmdash `/api/state` failure does not disable the fixed launch route.
5. **Restrictive policy retained.** Only the precise Kagi form action is added to CSP. Same-origin launch endpoints require no broader connection or form policy.
6. **Safe errors.** Invalid route inputs and unavailable configuration produce bounded errors without redirects, reflection, stack traces, credentials, or host details.

## Migration, Compatibility, and Rollback

There is no database migration, API version migration, local-storage migration, cache invalidation, or upstream rollout. Existing browser snapshots remain valid because all widget schemas stay at version `1`.

Deployment adds the private `LLMDASH_LAUNCH_URL` before release and restarts the existing service. If the value is omitted or rejected, homedash and all dashboard data remain usable; only the llmdash launch action returns its isolated safe error. Rollback removes the form, anchors, fixed routes, and setting parser without transforming any retained data.

## Architecture Acceptance Checks

- Existing API contract tests still accept unchanged kilometer `radiusKm` and `distanceKm` payloads.
- Route tests cover exact success destinations plus missing, malformed, encoded-slash, traversal, URL-like, query-injection, unsupported-method, missing-config, and invalid-config cases; every rejected case is non-redirecting.
- llmdash launch tests prove `LLMDASH_URL` and `LLMDASH_LAUNCH_URL` are independent and that source failures do not affect launch redirects.
- CSP tests prove the exact Kagi form action is allowed while unrelated form, script, connect, frame, and object destinations remain blocked.
- Client tests prove one shared form, focus only on initial mount, native Enter and explicit submit, no action for blank input, no persistence or pre-submit request, and link parity across both modes and all source states.
- Formatter tests cover `null`, zero, converted values on both sides of the `10 mi` boundary, rounding, and `50 km → 31 mi`; integration tests prove server-side eligibility and ordering remain unchanged.
- Production bundle and changed-file scans contain no real private launch hostname or setting value.

