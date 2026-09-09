# Schema — Mobile Bookmark Targets and Favicons

## Path

**Incremental (Extending existing schema).** Prior schema artifacts already define homedash's four version-1 widget envelopes, browser-owned preferences and snapshots, same-origin Fastify routes, fixed launch routes, and replaceable memory caches. This feature adds a server-owned favicon retrieval route and ephemeral cache plus a client presentation flow, but no database, durable schema, widget-envelope field, or migration.

## Current Schema State

### Application and persistence boundaries

Homedash remains one React/Vite/TypeScript browser application served by one Fastify/Node process on loopback port `1910`, with Tailscale providing private HTTPS. There is no database, ORM, or migration directory.

| Owner | Cumulative durable state after this feature |
|---|---|
| Browser | `homedash.preferences.v1`, `homedash.location.v1`, and independently validated `homedash.cache.<widget>.v1` snapshots for weather, bookmarks, eBird, and llmdash. No favicon state is added. |
| Host | Private environment configuration and the ordered `bookmarks.json` file. No favicon field or icon file is added. |
| Upstream systems | Open-Meteo, SnowRaven/eBird, and llmdash remain authoritative for their existing data. Bookmark origins may supply a conventional favicon but do not become authoritative application data. |
| Fastify process | Existing replaceable source caches plus the new bounded favicon cache. All are lost on restart and require no migration or backup. |

The device clock still owns the non-persisted `MoonPhaseLabel | null` derived by the prior moon-phase feature. It is unrelated to favicon retrieval and remains outside every widget contract.

Private host configuration remains cumulative and unchanged: loopback host/port; optional Home coordinates and label; weather unit; fixed SnowRaven and llmdash upstream URLs; optional distinct llmdash launch URL; eBird radius, window, and result limit; bookmark-file path; and the general upstream timeout. Favicon limits are fixed product contracts in this feature rather than new environment settings, so install/update and private-config preservation require no new value.

### Shared API and browser models

All shipped shared models remain cumulative version `1` contracts:

| Model | Post-feature contract |
|---|---|
| `ApiIssue` / `ApiMeta` / `WidgetEnvelope<T>` | Existing bounded issues, source timestamps, freshness, optional location provenance, and `schemaVersion: 1`; unchanged. |
| `WeatherSummary` | Existing current conditions, daily bounds, precipitation, wind, daylight, next event, time zone, and five-hour forecast; unchanged. |
| `Bookmark` | `id`, `group`, `name`, validated HTTP(S) `url`, and non-negative `order`; no favicon URL, bytes, status, or metadata is added. Production IDs remain the lowercase 16-hex digest generated from name, URL, and file position. |
| `BookmarksSummary` | Ordered `bookmarks` plus `invalidEntryCount`; unchanged. |
| `EbirdTarget` / `EbirdSummary` | Existing canonical target identity, locality, kilometer source values, target categories, month comparison, and source times; unchanged. Miles remain a presentation conversion. |
| `LimitWindow` / `LlmdashSummary` | Existing llmdash-supplied percentages, reset/capture times, provider identity, and diagnostics; unchanged. |
| `LocationSelector` / `StoredLocation` / `DevicePreferences` | Existing validated location fallback and per-browser mode/appearance records; unchanged. |
| `WidgetSnapshot<T>` | Existing independently stored version-1 widget envelope; a bookmark snapshot remains valid without favicon data. |
| `ApiErrorResponse` | Existing JSON error contract remains available to widget and launch routes. The favicon route deliberately uses an empty binary-resource `404` contract instead of adding an issue code or envelope. |

`bookmarks.json` remains an ordered array of `{ name, url, group? }`. `BookmarkService` remains the single reader and validator. Its **current bookmark registry** is the most recent successfully parsed configuration already represented by `lastGood`; a failed reread preserves that accepted registry and its stale UI behavior, while a later valid reread replaces the registry atomically.

### Cumulative cache ownership

| Cache | Existing/post-feature lifecycle |
|---|---|
| Open-Meteo weather | Existing memory cache: 10-minute request reuse and 30-minute UI stale threshold. |
| SnowRaven profile and metadata | Existing normalized in-memory profile retained until source upload time changes; metadata checked on its existing 15-minute boundary. |
| Nearby eBird observations | Existing 15-minute request reuse and 6-hour UI stale threshold, keyed without logging exact coordinates. |
| llmdash | Existing 5-second request reuse and 15-minute UI stale threshold. |
| Bookmarks | Existing last-successful envelope keyed by bookmark-file modification time; failed rereads retain the last valid list as stale. |
| Browser widget snapshots | Existing independent version-1 local records; hydration validates each widget and refreshes sources independently. |
| Favicons | Added process-only 128-entry LRU with 24-hour positive and 15-minute negative lifetimes, detailed below; it is not a widget cache and has no freshness UI. |

### Server routes

| Route | Cumulative responsibility |
|---|---|
| `GET /healthz` | Process health without upstream probes. |
| `POST /api/weather` | Existing normalized weather/daylight response. |
| `GET /api/bookmarks` | Existing version-1 ordered bookmark envelope. It never waits for or reports favicon state. |
| `GET /api/bookmarks/:bookmarkId/favicon` | **Added:** best-effort binary favicon for one currently accepted bookmark ID under the contract below. |
| `POST /api/ebird/summary` | Existing normalized eBird summary. |
| `GET /api/llmdash/summary` | Existing normalized llmdash summary. |
| `GET /launch/ebird/my-ebird` | Existing fixed My eBird redirect. |
| `GET /launch/ebird/map/:speciesCode` | Existing validated species-map redirect. |
| `GET /launch/llmdash` | Existing redirect through private `LLMDASH_LAUNCH_URL`. |
| `GET https://kagi.com/search?q=…` | Existing explicit native browser form navigation; not a homedash API route. |

The static application fallback continues to exclude `/api/` and `/launch/`. Security headers remain cumulative, including `Content-Security-Policy: …; img-src 'self' data:; …`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and `Cross-Origin-Resource-Policy: same-origin`.

### Added ephemeral favicon models

These are server-internal process models, not shared API types:

```ts
type FaviconMime = 'image/x-icon' | 'image/png' | 'image/jpeg'

type ValidatedFavicon = {
  bytes: Uint8Array
  mimeType: FaviconMime
  width: number
  height: number
}

type FaviconOutcome =
  | { kind: 'success'; image: ValidatedFavicon }
  | { kind: 'unavailable' }

type FaviconCacheEntry = {
  key: string                 // digest of the accepted bookmark ID + exact URL
  outcome: FaviconOutcome
  expiresAtMs: number
  lastAccessedAtMs: number
}
```

The cache key binds an outcome to both the deterministic ID and exact accepted URL even though the production ID already incorporates the URL. This defense-in-depth prevents an icon from crossing a configuration turnover or a future identifier-generation change. `width` and `height` are validation evidence only and are never returned as headers, API fields, or UI data.

`FaviconResolver` owns three replaceable structures:

- An insertion-ordered least-recently-used `Map` capped at 128 positive and negative entries. A hit moves to most-recent position; insertion evicts from the least-recent end until the cap is met.
- An in-flight `Map<cacheKey, Promise<FaviconOutcome>>` so concurrent misses for one bookmark share exactly one retrieval and result.
- A fair four-permit queue for distinct upstream retrievals. One absolute 2,000-millisecond deadline begins at favicon route entry and covers current-bookmark lookup plus the remaining resolver queue, redirect, body-reading, and validation work. A coalesced observer retains its own route deadline even when it joins a shared miss created by another request.

Positive entries expire 24 hours after successful validation; unavailable entries expire 15 minutes after failure. Expired entries are removed before use and never served stale. Positive bodies are individually capped at 131,072 decoded bytes, so 128 positive entries retain at most 16 MiB of decoded image bodies. Metadata overhead is bounded separately by the same 128-entry cap. No favicon cache survives restart or writes to disk, host configuration, localStorage, sessionStorage, or the Cache Storage API.

### Bookmark lookup and stale-ID contract

Every favicon request follows this membership order before consulting the favicon cache:

1. Reject a query string, non-`GET` method, malformed path, encoded separator/traversal form, or decoded ID outside `^[a-f0-9]{16}$` with an empty `404` and `Cache-Control: no-store`.
2. Ask the shared `BookmarkService` to observe the bookmark file using its existing modification-time and last-good behavior, then look up the exact ID in its current accepted registry.
3. If no accepted entry matches, evict any cache/in-flight reference for that ID and return the same empty no-store `404` without an upstream request.
4. Only after membership succeeds, derive the cache key from the returned ID and exact URL and consult or create the favicon retrieval.

This ordering means a removed identifier can never be revived by an otherwise fresh icon cache entry. If a configuration reread fails, the prior accepted registry remains eligible just as its stale bookmark envelope remains usable. Once a valid changed file is accepted, new requests use only that snapshot; old IDs return no-store `404`. A fetch already started from an earlier accepted snapshot is never reused by the new key, and its completion cannot alter the bookmark registry or envelope.

### Fixed-origin retrieval boundary

For an eligible bookmark, the resolver constructs the first upstream target from `new URL('/favicon.ico', bookmarkUrl.origin)`. The bookmark path, query, and fragment are discarded. No favicon route input participates in the destination.

The upstream exchange has this closed contract:

- Method is `GET`; no body is sent. Browser cookie, authorization, referrer, client headers, and homedash private configuration are not forwarded. URL credentials are already forbidden by the bookmark schema.
- Redirect handling is manual. At most two redirects may be followed. A relative `Location` is resolved against the current hop, then must retain the initial URL's exact scheme, hostname, and effective port, contain no credentials, and remain valid HTTP(S). Cross-origin and third redirects are rejected before their destination is contacted.
- The one absolute request deadline is not reset per hop. Timeout, abort, network error, missing/invalid `Location`, any status other than `200`, and a partial body all produce `unavailable`.
- Body reading is streaming and decoded-byte-counted. An advertised or observed body above 131,072 bytes is cancelled and rejected; a compressed response cannot expand beyond the decoded limit.
- The upstream `Content-Type` is never forwarded or trusted alone. An absent or generic binary type may be accepted when bytes validate; a specific declared supported image type that contradicts the detected signature is rejected.

No address-class block is added: local, LAN, and tailnet bookmark origins are legitimate product inputs. The host-owned bookmark file is the authorization boundary. Browser callers can select only an opaque accepted ID, the requested path is fixed, credentials are absent, and redirects cannot leave the configured origin.

### Image validation and response contract

A small pure server validator accepts only structurally valid, non-animated ICO, PNG, or JPEG bodies without decoding or transforming pixels and without a native image dependency:

- **ICO:** require the icon header, 1–32 directory entries, disjoint in-buffer body ranges, at most 16 MiB of cumulative validation work, advertised dimensions between 1×1 and 512×512 for every entry, and a complete embedded PNG or supported DIB palette/XOR/AND payload; preflight every range and work bound before validating each unique body once, then normalize to `image/x-icon`.
- **PNG:** require the PNG signature, a valid first `IHDR` with dimensions from 1×1 through 512×512, bounded checksummed chunk traversal through `IEND`, no `acTL` animation chunk, and one zlib stream whose filter bytes and non-interlaced or Adam7 scanline sizes exactly match `IHDR`; normalize to `image/png`.
- **JPEG:** require a valid SOI, bounded marker traversal to one supported SOF dimension marker, dimensions from 1×1 through 512×512, referenced nonempty quantization and Huffman tables, at least one structurally valid nonempty scan covering the frame components, and a terminal EOI; normalize to `image/jpeg`.

SVG, GIF, WebP, APNG, HTML, an unsupported ICO payload, unrecognized or internally inconsistent bytes, and a recognized content-type/signature mismatch become `unavailable`. The validator is total over arbitrary bounded bytes: it returns an outcome and never leaks a parser exception through the route.

| Outcome | Browser response |
|---|---|
| Valid current ID + cached/fetched valid image | `200`, normalized `Content-Type`, computed `Content-Length`, `Cache-Control: private, max-age=86400`, and inherited `nosniff`; no upstream header is copied. |
| Valid current ID + unavailable retrieval result, including a failed refetch after expiry | Empty `404`, `Cache-Control: private, max-age=900`, and inherited security headers. The negative result is cached for 15 minutes. |
| Invalid, unknown, removed, or stale ID; query; unsupported method; malformed favicon namespace URL | Empty non-redirecting `404`, `Cache-Control: no-store`, and inherited security headers; no negative cache entry and no upstream request. |

The favicon namespace must receive its empty response contract even when Fastify rejects malformed URLs or unsupported methods before the ordinary handler. It therefore uses the same raw-path/framework-error hardening already established for `/launch`, but never reflects raw paths or errors. The favicon route sets `exposeHeadRoute: false`; `HEAD` and every non-`GET` method take the empty no-store path.

### Frontend data flow

`BookmarkGroups` remains the only grouping and ordering owner and continues to receive the unchanged `Bookmark[]` from either the live envelope or the validated `homedash.cache.bookmarks.v1` snapshot. A small shared presentational `BookmarkFavicon` builds only:

```text
/api/bookmarks/{encodeURIComponent(bookmark.id)}/favicon
```

It reserves the Designer-specified fixed icon slot and renders a local neutral fallback immediately. A decorative image (`alt=""`, hidden from the accessibility tree) may replace the fallback only after its load succeeds; error returns to the fallback and removes the broken-image surface. The surrounding native anchor retains the complete bookmark name as visible text and accessible name, and its configured URL remains the only navigation destination.

```text
validated bookmark envelope or browser snapshot
  -> BookmarkGroups (existing group and file order)
  -> native bookmark anchor (name + fixed icon slot)
      -> same-origin favicon GET by encoded opaque ID
          -> BookmarkService current-registry lookup
          -> LRU / in-flight coalescer / four-permit deadline
          -> exact configured origin + /favicon.ico
          -> bounded byte/signature/dimension validation
          -> normalized image OR empty 404
      -> loaded decorative icon OR local neutral fallback
```

The image request is browser-driven only when a bookmark is rendered. `GET /api/bookmarks`, cached hydration, global refresh, widget freshness, and bookmark link activation never wait for, preflight, or retry favicon availability. Dawn/Dense and appearance switches may remount the shared component, but the same URL, browser HTTP cache, and server cache preserve the outcome without application-managed persistence.

## Changes in This Feature

### Added

- `GET /api/bookmarks/:bookmarkId/favicon` with strict namespace, method, ID, response, cache, and non-reflection behavior.
- A pure bounded ICO/PNG/JPEG validator and normalized `ValidatedFavicon` result.
- `FaviconResolver` with exact-origin manual redirects, one absolute deadline, decoded byte limits, positive/negative LRU caching, in-flight coalescing, and four-request concurrency control.
- A server-internal bookmark registry lookup by existing deterministic ID. This is read-only and exposes no new field to the client.
- A shared `BookmarkFavicon` presentation element and fixed icon slot inside every existing bookmark anchor.
- Resolver, parser, route, concurrency/cache, component, accessibility, browser-network, and viewport tests for the new contracts.

### Modified

- `BookmarkService` gains an atomic read-only ID lookup over its existing last-successful configuration; its parsing, generated IDs, file-order behavior, stale envelope, and public response remain unchanged.
- Fastify application assembly gives the favicon resolver the existing injectable fetch boundary and registers the route plus favicon-specific malformed-request handling before the generic `/api/` fallback.
- `BookmarkGroups` adds icon markup inside the existing native anchors without changing grouping, order, names, destinations, or dense/non-dense ownership.
- Existing bookmark CSS is refined at mobile widths to the approved 48×48 target minimum and the Designer's fixed icon/fallback geometry while preserving focus clearance and bounded overflow.

These are additive runtime and presentation changes. No existing stored field, relationship, identifier algorithm, API version, route meaning, or production record is modified.

### Unchanged

- No database table, ORM model, migration, persistent cache, or durable favicon record exists.
- `bookmarks.json`, `Bookmark`, `BookmarksSummary`, `BookmarksEnvelope`, `schemaVersion: 1`, `homedash.cache.bookmarks.v1`, and every other shared widget contract stay byte-compatible.
- Bookmark file order remains display order; favicon state never affects group membership, inclusion, navigation, freshness, retry, or stale behavior.
- Weather, eBird, llmdash, moon-phase, preference, location, Kagi search, and fixed launch contracts remain unchanged.
- The browser makes no direct request to a bookmark origin or favicon aggregator, and CSP image sources remain exactly `'self' data:`.
- Loopback binding, Tailscale HTTPS, public bootstrap behavior, private configuration preservation, and deployment topology remain unchanged.

## Migration Plan

1. Add the bounded image validator with malicious/truncated format fixtures before connecting it to network data.
2. Extend `BookmarkService` with current-registry lookup while retaining the existing atomic last-good envelope behavior; prove valid config replacement, failed reread retention, and removed-ID rejection.
3. Add `FaviconResolver` behind the existing injectable fetch seam, then verify destination construction, manual same-origin redirects, one deadline, byte/dimension/type validation, cache TTL/LRU behavior, coalescing, concurrency, and cleanup.
4. Register the exact favicon route with `exposeHeadRoute: false`, favicon-namespace error hardening, empty response helpers, inherited security headers, and no changes to the bookmark envelope or CSP.
5. Add the shared frontend favicon/fallback component inside existing bookmark anchors, then apply Designer-approved 48×48 mobile geometry and focus-safe layout in Dawn and Dense.
6. Run controlled unit/integration tests, the complete 360×800 and 1440×900 mode/appearance matrix, the 360×650 oversized-payload case, browser-network/CSP inspection, accessibility checks, and the full existing suite.
7. Deploy through the ordinary existing build/restart path. There is no data migration or cache warm-up; the favicon cache starts empty. Rollback removes the route, resolver, icon component, and styles, after which all pre-feature envelopes and browser snapshots continue to work unchanged.

## Design Decisions

1. **Incremental, not frontend-only.** The feature adds a server route, an upstream read boundary, and cache/coalescing state, so it extends the runtime schema even though it adds no durable model.
2. **The bookmark envelope stays canonical.** Favicon URL, status, dimensions, and bytes are intentionally absent from `Bookmark`; this preserves schema version 1 and existing browser snapshots.
3. **Current membership precedes every cache hit.** The resolver cannot serve a removed ID merely because an icon remains cached; valid configuration replacement immediately governs subsequent requests.
4. **The host file authorizes origins.** Private and tailnet origins remain supported, while the opaque-ID route, fixed `/favicon.ico` path, absent credentials, and same-origin-only redirects prevent a browser caller from turning the service into an arbitrary proxy.
5. **Coverage yields to privacy and safety.** There is no browser-direct request, aggregator, page scrape, authentication forwarding, cross-origin redirect, or CSP expansion. Sites without a conventional valid icon receive the neutral fallback.
6. **Validation is byte-led and bounded.** A small total parser, decoded-body cap, dimension cap, non-animated format allowlist, normalized MIME response, and `nosniff` avoid trusting remote headers or executing active content without adding a native image dependency.
7. **One deadline governs all work.** Current-bookmark lookup, queueing, redirects, transfer, and validation share 2,000 milliseconds from route entry; redirect hops cannot multiply latency, a late lookup cannot start an upstream fetch, and late retrieval results cannot mutate the cache after the shared request has resolved unavailable.
8. **Both cache polarities are bounded.** A 128-entry LRU, 24-hour positive TTL, 15-minute negative TTL, and at most four upstream requests protect the Pi while allowing normal five-bookmark rendering; all state is replaceable on restart.
9. **Failure is cosmetic and local.** The fallback occupies the slot from first paint, so a failed or slow icon neither shifts layout nor changes bookmark/widget state, source freshness, refresh progress, or navigation.
10. **The established viewport contract wins.** Mobile targets increase to 48×48 only within a composition that preserves no document or bookmark-region scrolling for the normal 360×800 payload and source-owned overflow for exceptional cases.
