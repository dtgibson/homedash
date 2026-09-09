# PRD — Mobile Bookmark Targets and Favicons
**Feature:** mobile-bookmark-targets-and-favicons
**Date:** 2026-09-09
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview
This feature makes the existing Dawn and Dense bookmark surfaces easier to recognize and tap on phones by enlarging link targets and adding best-effort favicons. It preserves homedash's host-owned bookmark order, same-origin browser boundary, and one-screen contract for the normal payload.

## User Stories

> **US-01** — As the owner opening homedash on my phone, I want generous bookmark targets, so that I can select a familiar destination without precise aiming.

> **US-02** — As the owner scanning my bookmarks, I want familiar site icons beside their names, so that I can recognize destinations more quickly.

> **US-03** — As the owner relying on homedash during partial failures, I want every bookmark name and link to work without its favicon, so that a cosmetic network failure never blocks navigation.

> **US-04** — As the owner using either Dawn or Dense, I want the normal bookmark set to remain visible without scrolling, so that the dashboard keeps its one-glance value.

> **US-05** — As the owner of a private tailnet start page, I want automatic icon retrieval to preserve the same-origin browser boundary, so that recognition does not require a tracking service or expose browser requests to every bookmark origin.

## Functional Requirements

### Bookmark Presentation and Navigation

> **FR-01** — The app shall render every valid bookmark in both Dawn and Dense with the name, destination, group membership, and file order supplied by the existing bookmark envelope.

> **FR-02** — At viewport widths of 680 CSS pixels or less, each rendered bookmark anchor shall have a bounding box at least 48 CSS pixels wide and 48 CSS pixels high in both presentations.

> **FR-03** — The complete visible icon-and-label area inside each bookmark target shall activate one native anchor; adjacent targets shall not overlap or share an activation area.

> **FR-04** — Each bookmark shall retain visible name text and native same-tab navigation to its configured HTTP(S) destination, with no scripted navigation, popup, or forced new tab.

> **FR-05** — Each bookmark target shall reserve one fixed-size icon slot from its initial render, show the neutral local fallback in that slot until a valid favicon is available, and replace only the slot contents on success without moving the label or surrounding layout.

> **FR-06** — A favicon and its neutral fallback shall be decorative and excluded from the accessibility tree; the anchor's accessible name shall remain the complete bookmark name in every icon state.

> **FR-07** — Favicon loading, success, rejection, timeout, cache state, or failure shall not add, remove, reorder, regroup, disable, or change the destination of any bookmark.

### Viewport, Overflow, and Focus

> **FR-08** — With the normal five-target/five-bookmark fixture, Dawn and Dense shall show all five bookmarks without document scrolling, horizontal overflow, or bookmark-region scrolling at both 360×800 and 1440×900 CSS-pixel viewports.

> **FR-09** — Keyboard focus on every bookmark shall use the established 2 CSS-pixel bright-gold outline with a 3 CSS-pixel offset, retain at least 5 CSS pixels of visible clearance from clipping boundaries, and shall not scroll the document or bookmark region for the normal fixture at 360×800.

> **FR-10** — On viewports shorter than 800 CSS pixels or with more than five bookmarks, overflow may scroll only inside the bookmark-owned region; every bookmark shall remain reachable without horizontal or document-level scrolling.

> **FR-11** — Switching between Dawn and Dense or among System, Light, and Dark appearance shall preserve the same loaded bookmark data, favicon outcome, focus semantics, and navigation behavior.

### Favicon Resolution Contract

> **FR-12** — The server shall expose one same-origin `GET /api/bookmarks/:bookmarkId/favicon` resource for a lowercase 16-character hexadecimal identifier that belongs to a currently valid host-configured bookmark; every other method shall return an empty, non-redirecting `404` with `Cache-Control: no-store`, and every malformed, unknown, or stale identifier shall avoid an upstream request.

> **FR-13** — For an eligible bookmark, the resolver shall request only `/favicon.ico` at that bookmark URL's exact validated origin, discarding the bookmark path, query, and fragment and never accepting a URL, host, path, or destination from the favicon request.

> **FR-14** — The resolver shall follow at most two upstream redirects, and only when every redirect retains the original scheme, hostname, and effective port; it shall reject a cross-origin, credential-bearing, malformed, or third redirect.

> **FR-15** — An upstream favicon request shall contain no forwarded browser cookie, authorization, referrer, query, request body, or client-selected header and shall send no credentials derived from the bookmark URL or homedash configuration.

> **FR-16** — The resolver shall accept only an upstream `200` response whose decoded body is no larger than 131,072 bytes, whose intrinsic dimensions are between 1×1 and 512×512 pixels, and whose signature is valid non-animated ICO, PNG, or JPEG data; HTML, SVG, GIF, WebP, APNG, mismatched or unrecognized data, partial responses, and every other status shall be unavailable.

> **FR-17** — A successful favicon response shall be `200`, use the normalized MIME type matching the validated image signature, include `Cache-Control: private, max-age=86400` and `X-Content-Type-Options: nosniff`, and expose no upstream headers other than the normalized content type and computed content length.

> **FR-18** — A malformed, unknown, or stale bookmark identifier shall return `404` with an empty body and `Cache-Control: no-store`; an unavailable, timed-out, rejected, or invalid upstream favicon shall return `404` with an empty body and `Cache-Control: private, max-age=900`.

> **FR-19** — The favicon resource shall never redirect the browser and shall never return or reflect a bookmark URL, upstream destination, upstream response body, rejected input, credential, stack trace, or internal error detail.

### Retrieval, Cache, and Failure Isolation

> **FR-20** — The resolver shall keep a process-local least-recently-used cache of no more than 128 bookmark results, with successful results retained for 24 hours and unavailable results retained for 15 minutes; the cache shall create no durable file, database, application-managed localStorage/sessionStorage/Cache Storage record, or host-configuration entry and shall clear on process restart.

> **FR-21** — Concurrent requests for the same uncached bookmark shall share one upstream retrieval, no more than four upstream favicon retrievals shall run at once, and each browser favicon request shall resolve as success or unavailable within 2,000 milliseconds including queue and network time.

> **FR-22** — The bookmarks endpoint, cached bookmark hydration, bookmark text, and bookmark navigation shall not wait for or probe favicon availability; icon retrieval may begin only when a rendered bookmark requests its same-origin favicon resource.

> **FR-23** — After a valid host bookmark configuration change is observed, a changed bookmark identifier or URL shall resolve only against the new current entry, and an identifier no longer present shall behave as stale under FR-18 without using its former cached icon.

> **FR-24** — The delivered browser policy shall retain `img-src 'self' data:` and shall add no external image origin, third-party favicon service, preconnect, prefetch, or direct browser request to a bookmark origin.

## Non-Functional Requirements

> **NFR-01 — Performance:** Bookmark names and anchors shall be usable as soon as existing bookmark data renders; a gated or 2,000-millisecond favicon request shall not delay dashboard readiness, source refresh, mode switching, or navigation.

> **NFR-02 — Accessibility:** Bookmark targets shall meet WCAG 2.2 AA keyboard, focus-visibility, contrast, and accessible-name expectations; icon success or fallback shall introduce no duplicate speech, unlabeled link, or color-only meaning.

> **NFR-03 — Responsive Layout:** The release matrix shall retain no document-level horizontal or vertical scrolling at 360×800 and 1440×900 for the normal payload in both modes and all three appearances, including the full 5 CSS-pixel focus clearance.

> **NFR-04 — Security and Privacy:** Automatic browser traffic shall remain same-origin, favicon retrieval shall not become an arbitrary proxy, and all upstream selection, redirects, content, timing, and resource use shall obey FR-12 through FR-21.

> **NFR-05 — Resource Bounds:** The server shall never retain more than 128 decoded favicon results or 16 MiB of decoded favicon bodies, run more than four upstream favicon requests concurrently, or spend more than 2,000 milliseconds serving one uncached browser request.

> **NFR-06 — Compatibility:** Bookmark targets, fallback, accepted raster/ICO favicons, and same-tab navigation shall work in the current and previous major Safari, Chrome, and Firefox releases, including mobile Safari behavior represented by the existing mobile test profile.

> **NFR-07 — Resilience:** Any favicon-specific exception, unsupported image, closed connection, timeout, cache miss, or upstream failure shall degrade only that icon to the neutral fallback and shall not alter a bookmark widget's freshness or error state.

> **NFR-08 — Visual Stability and Motion:** Icon state changes shall produce no measurable target-size or position change and no animation; the existing reduced-motion behavior shall remain unchanged.

## Out of Scope

- Adding, editing, deleting, grouping, or reordering bookmarks in the page.
- Changing the host bookmark file format, bookmark envelope, schema version, local snapshot key, or configured destination behavior.
- A durable favicon cache, database, uploaded/custom icon, per-bookmark icon setting, or icon-management interface.
- Browser-direct favicon retrieval, a third-party favicon aggregator, webpage metadata scraping, or a caller-selectable URL proxy.
- Authentication forwarding, cookie forwarding, logged-in-site icon discovery, or cross-origin redirect following.
- Guaranteeing a favicon for a site that does not expose a valid conventional `/favicon.ico` image.
- Eliminating source-region scrolling for unusually short viewports or payloads larger than five bookmarks.
- New widgets, a third display mode, accounts, analytics, public-internet exposure, or application-level bookmark management.

## Open Questions

None — all decisions are resolved in this document.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Bookmark parity and navigation (FR-01, FR-03, FR-04, FR-07, FR-11) | Controlled groups render the same names, URLs, grouping, and file order in Dawn and Dense; every complete icon-and-label target is one native same-tab anchor; all values remain identical through mode and appearance switches and every favicon state. |
| QA-02 | Mobile target geometry (FR-02, FR-03) | At 360×800, the bounding rectangle of every bookmark anchor in Dawn and Dense is at least 48×48 CSS pixels, target rectangles do not intersect, and clicking the icon, label, and target padding activates the same link. |
| QA-03 | Icon slot, fallback, and semantics (FR-05, FR-06) | Pending, successful, unavailable, invalid, and timed-out icon fixtures always occupy one unchanged slot; success changes only its pixels, failure shows the neutral fallback, the text remains visible, and the accessibility tree exposes exactly one link named with the complete bookmark name and no icon node. |
| QA-04 | Release viewport matrix (FR-08; NFR-03) | In both modes and System, Light, and Dark at 360×800 and 1440×900 with five eBird targets and five bookmarks, document `scrollHeight`/`scrollWidth` do not exceed client dimensions, the bookmark region does not overflow, and all five bookmark targets plus their 5-pixel focus clearance remain inside the viewport. |
| QA-05 | Keyboard focus (FR-09; NFR-02) | Tabbing through every bookmark at 360×800 shows a 2-pixel bright-gold outline with 3-pixel offset and at least 5 pixels of unclipped clearance; neither document nor bookmark-region scroll position changes. |
| QA-06 | Exceptional overflow (FR-10) | At 360×650 with 12 bookmarks, the document has no vertical or horizontal overflow, only the bookmark-owned region scrolls, and keyboard and touch traversal can reach all 12 links without horizontal scrolling. |
| QA-07 | Route eligibility and method handling (FR-12) | One current lowercase 16-hex bookmark ID reaches its icon lookup; malformed, unknown, removed, and stale IDs plus HEAD/POST/PUT/DELETE requests are non-redirecting, make zero upstream calls, and return an empty `404` with `Cache-Control: no-store`. |
| QA-08 | Fixed origin and redirect boundary (FR-13, FR-14) | A bookmark with a path/query/fragment requests only its exact origin's `/favicon.ico`; zero, one, and two same-origin redirects can succeed, while a changed scheme/host/port, credential-bearing redirect, or third redirect is rejected without contacting the rejected destination. |
| QA-09 | Upstream request privacy (FR-15; NFR-04) | A recording upstream receives no browser cookie, authorization, referrer, query, body, client-selected header, configured credential, or raw favicon-route input. |
| QA-10 | Image acceptance bounds (FR-16) | Valid non-animated ICO, PNG, and JPEG fixtures from 1×1 through 512×512 pixels and at or below 131,072 decoded bytes succeed; a 513-pixel dimension, 131,073-byte body, HTML, SVG, GIF, WebP, APNG, mismatched, unrecognized, partial, non-200, or malformed payload is unavailable. |
| QA-11 | Successful response contract (FR-17) | Each accepted format returns `200`, the signature-matched normalized MIME type and computed length, `private, max-age=86400`, and `nosniff`; no upstream cookie, cache, redirect, server, or diagnostic header reaches the browser. |
| QA-12 | Failure response and non-reflection (FR-18, FR-19) | Malformed/unknown/stale IDs return empty `404 no-store`; upstream failures return empty `404 private, max-age=900`; no case redirects or includes an ID, URL, body, rejected input, credential, stack, or internal detail. |
| QA-13 | Cache policy and invalidation (FR-20, FR-23; NFR-05) | Fake-clock and 129-key tests prove 24-hour positive and 15-minute negative reuse, least-recently-used eviction at 128 entries, no more than 16 MiB of decoded bodies, immediate rejection of removed IDs, refetch for changed IDs/URLs, and an empty cache after process restart with no favicon artifact written to disk or application-managed browser storage. |
| QA-14 | Coalescing, concurrency, and deadline (FR-21; NFR-05) | Parallel requests for one ID produce one upstream call, mixed IDs never exceed four simultaneous upstream calls, and every browser request completes with `200` or empty `404` within 2,000 milliseconds. |
| QA-15 | Non-blocking isolation (FR-07, FR-22; NFR-01, NFR-07, NFR-08) | With all icon requests gated until timeout, bookmark text and native links render and work immediately, dashboard readiness/refresh/mode changes remain usable, no widget enters stale/error because of icons, fallbacks appear independently, and target rectangles and positions do not change or animate. |
| QA-16 | Configuration turnover (FR-23) | Reloading a valid changed host file makes the new bookmark ID resolve from only its new URL, and the removed prior ID returns empty `404 no-store` without serving or contacting its former origin. |
| QA-17 | Browser network and CSP boundary (FR-24; NFR-04) | Browser capture shows only same-origin favicon requests and no third-party, bookmark-origin, preconnect, or prefetch traffic; production CSP remains exactly `img-src 'self' data:` for image sources and blocks an attempted external icon. |
| QA-18 | Compatibility and regression (FR-01–FR-24; NFR-01–NFR-08) | The established unit, integration, Playwright viewport, accessibility, and production-build checks pass, and current Chromium, Firefox, and WebKit engine smokes retain working names, links, fallback, accepted icons, focus, and source isolation in both presentations. |
