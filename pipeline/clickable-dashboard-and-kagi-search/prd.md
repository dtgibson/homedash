# PRD — Clickable Dashboard and Kagi Search

**Feature:** `clickable-dashboard-and-kagi-search`  
**Date:** 2026-09-08  
**Stage:** 2 — The Planner  
**Source:** `strategic-brief.md` (approved)

## Feature Overview

Homedash will become an action-oriented start page while preserving its established one-glance character. A compact Kagi search control in the shared toolbar will support immediate keyboard-first search. Existing eBird monthly progress, eBird targets, and llmdash source identity will become navigation affordances in both Dawn and Dense. All displayed eBird distances and radius context will use miles, while the normalized source contract and target-selection behavior remain in kilometers.

The feature adds destinations, not content. It does not add a widget, change source ownership, or alter how eBird targets and llmdash quota values are produced.

## User Stories

> **US-01** — As the owner opening homedash, I want the Kagi search field ready for typing, so that I can begin a web search without first clicking a control.

> **US-02** — As the owner using touch or assistive technology, I want search to have a clear label and explicit submit affordance, so that the action is understandable without relying on autofocus or a physical keyboard.

> **US-03** — As a birder reviewing monthly progress, I want to open My eBird from that context, so that I can continue into my complete eBird record.

> **US-04** — As a birder reviewing a nearby target, I want to open that species' eBird map, so that I can act on the target without searching for it again.

> **US-05** — As the owner reviewing coding runway, I want to open the full llmdash dashboard on Hephaestus, so that I can inspect details beyond the homedash summary.

> **US-06** — As a birder in the United States, I want target distances and search-radius context in miles, so that I do not have to mentally convert kilometers.

> **US-07** — As the owner switching between Dawn and Dense on phone and desktop, I want the same actions and data behavior in either presentation, so that mode choice remains purely presentational.

## Primary Flows

### Search with Kagi

1. The owner opens a new homedash document.
2. The Kagi query field receives initial focus once.
3. The owner types a query and submits with Enter or the visible submit control.
4. Homedash performs an ordinary same-tab GET navigation to Kagi's results page with the query URL-encoded in Kagi's `q` parameter.
5. If the query is empty after trimming surrounding whitespace, homedash stays on the current page and sends no request to Kagi.

### Continue from eBird context

1. The owner activates the monthly-progress link and navigates to My eBird, or activates a rendered target and navigates to that target's species map.
2. The action uses a semantic same-tab link, so browser history, copy-link, context-menu, and modifier-key behaviors remain native.
3. Species-map navigation is derived only from the target's canonical `speciesCode`; display names and localities never become destination identifiers.

### Continue to llmdash

1. The owner activates the llmdash source identity in either presentation or any llmdash data state.
2. Homedash invokes a fixed server-owned launch action.
3. The server redirects to the separately configured llmdash dashboard destination on Hephaestus; the browser cannot supply or override that destination.

## Functional Requirements

### Kagi Search

**FR-01** — The app shall render one compact Kagi search form in shared application chrome so it is present in both Dawn and Dense without duplicating query state between the presentations.

**FR-02** — On the initial load of a newly opened document, the query input shall receive focus after the application mounts. Mode changes, appearance changes, source refreshes, location retries, target-category changes, and source-state updates shall not move focus back to the input.

**FR-03** — Submitting a non-empty query shall perform a standard same-tab GET navigation to `https://kagi.com/search` with the submitted query URL-encoded as the `q` parameter.

**FR-04** — Before submission, the app shall use the query with surrounding whitespace removed to determine emptiness. An empty or whitespace-only query shall cause no page navigation and no request to Kagi.

**FR-05** — Homedash shall not request suggestions, prefetch Kagi results, persist query text, add the query to dashboard telemetry or client-visible logs, or transmit query content before explicit submission.

**FR-06** — The search control shall expose a persistent accessible name that identifies Kagi, a visible text-entry affordance, and an explicit submit control usable by keyboard and touch. Native Enter submission from the input shall remain supported.

### eBird and llmdash Navigation

**FR-07** — Whenever the eBird month summary is rendered, its month-summary context shall include a semantic link to the fixed My eBird launch action in both Dawn and Dense.

**FR-08** — Every rendered eBird target with a valid canonical `speciesCode` shall expose a semantic link to that species' eBird map in both Dawn and Dense. The link's accessible name shall identify the species and destination purpose.

**FR-09** — Species-map destinations shall be generated from the canonical `speciesCode` only. Common name, locality, observation date, coordinates, and caller-supplied absolute URLs shall not influence the destination.

**FR-10** — The llmdash source identity shall be a semantic navigation link in both Dawn and Dense while llmdash data is loading, fresh, stale, partial, or unavailable. Source failure shall not remove or disable a valid configured launch affordance.

**FR-11** — My eBird, species-map, and llmdash navigation shall use fixed same-origin launch actions or an equivalent server-owned destination-resolution mechanism. The client shall not be able to submit an arbitrary redirect destination.

**FR-12** — A species-map launch request shall accept only a strictly validated species-code identifier and shall assemble the final destination from a fixed eBird map base. An invalid or missing identifier shall return a non-redirecting client error.

**FR-13** — The llmdash dashboard launch destination shall be supplied by a private host setting distinct from the existing llmdash data-source URL. The server shall accept only a valid `http` or `https` destination and shall fail safely without redirecting when the setting is absent or invalid.

**FR-14** — The My eBird, species-map, and llmdash affordances shall use ordinary same-tab semantic links with no forced new window, scripted popup, embedded frame, or download behavior.

**FR-15** — Public configuration examples and deployment documentation shall describe the llmdash launch setting with a non-sensitive placeholder. The real Hephaestus hostname or URL shall not be added to tracked files.

### Miles Presentation

**FR-16** — The server-to-client eBird contract shall continue to represent the configured radius as `radiusKm` and target distance as `distanceKm`; no source request, normalized value, cache key, or configuration unit shall be changed to miles.

**FR-17** — A shared presentation formatter shall convert kilometers to statute miles using `1 km = 0.621371 mi`. Values below 10 miles shall display one decimal place; values at or above 10 miles shall display the nearest whole mile; a null target distance shall remain `distance unknown`.

**FR-18** — Every user-visible eBird target distance and observation-radius reference in Dawn and Dense shall use the shared miles formatter and a clear `mi` or `miles` unit. No eBird distance or radius copy shall display `km`.

**FR-19** — The unit conversion shall not change the configured observation radius, target eligibility, category membership, deduplication, five-target cap, shortest-distance-first ordering, recency tie-breaker, or treatment of unknown distance.

### Presentation Parity and Regression Boundaries

**FR-20** — Dawn and Dense shall expose the same Kagi, My eBird, species-map, and llmdash destinations with equivalent labels, availability, keyboard behavior, and focus indication across System, Light, and Dark appearance settings.

**FR-21** — The search control and navigation affordances shall integrate into existing toolbar and widget content rather than add a new widget, new dashboard data source, third display mode, or management workflow.

**FR-22** — Existing per-browser mode and appearance persistence, location selection and fallback, manual refresh, target-category selection, independent source loading and error states, stale-data behavior, and bookmark ordering shall continue to operate unchanged.

## Non-Functional Requirements

**NFR-01 — Accessibility:** The new form and links shall be keyboard operable, have visible focus indicators, expose meaningful accessible names, preserve logical focus order, and meet WCAG 2.2 AA contrast in both modes and all appearance settings. Destination meaning shall not depend on color or hover alone.

**NFR-02 — Responsive one-screen layout:** At 1440×900 and 360×800 CSS pixels, both Dawn and Dense shall render the normal five-target/five-bookmark payload without horizontal overflow or document scrolling. Search and links shall not obscure, overlap, or truncate the existing controls and essential values.

**NFR-03 — Overflow containment:** At smaller viewport heights or with payloads larger than the normal fixture, the existing source-owned bounded overflow behavior shall remain usable; new controls shall not introduce a second competing document-level scroll region.

**NFR-04 — Compatibility:** Search, initial focus, and navigation shall work in the current and previous major releases of Safari, Chrome, and Firefox, including mobile Safari. Mobile autofocus may open the software keyboard, but the field and submit action shall remain visible and the page shall remain free of horizontal overflow.

**NFR-05 — Security:** Outbound navigation shall remain compatible with a restrictive Content Security Policy. Any policy change shall allow only the exact form or navigation destinations required by this feature and shall not broaden script, connection, frame, object, or arbitrary form-action sources.

**NFR-06 — Privacy:** No private upstream hostname, launch hostname, credential, coordinate, real bookmark, or private setting shall appear in client bundles, committed configuration, repository history introduced by this feature, or client-visible diagnostic logs.

**NFR-07 — Performance:** The search form and link treatments shall not add a background network request, materially delay the existing usable-shell target, or make dashboard source rendering wait on destination resolution.

**NFR-08 — Resilience:** Missing or invalid launch configuration and a failed launch response shall remain isolated from weather, bookmarks, eBird data rendering, llmdash data rendering, preferences, and refresh behavior.

## Dependencies and Resolved Assumptions

- Kagi's standard results contract is `https://kagi.com/search?q=<encoded query>`; homedash does not require a Kagi API key because it performs browser navigation rather than an API request.
- The fixed eBird destinations are My eBird at `https://ebird.org/myebird` and species maps rooted at `https://ebird.org/map/<speciesCode>`, exposed through constrained launch actions where server ownership is required.
- The deployment owner will provide the private llmdash dashboard destination through the new host setting before release. It is not assumed to equal `LLMDASH_URL`, which remains a server-to-server data source.
- Existing validated `speciesCode`, `distanceKm`, and `radiusKm` fields are sufficient; this feature does not require a new upstream eBird or SnowRaven contract.
- Initial focus is intentional on mobile as well as desktop. Browser/platform accessibility settings may still suppress or alter software-keyboard behavior outside application control.

## Out of Scope

- Search suggestions, autocomplete, search history, recent queries, alternate engines, an engine picker, or a configurable Kagi endpoint.
- Proxying Kagi results, storing or analyzing queries, search analytics, or background requests to Kagi.
- Embedding eBird, Kagi, or llmdash in homedash.
- Editing eBird observations, lists, targets, or media.
- Changing the eBird observation radius, time window, target rules, deduplication, result limit, ordering, or server-side kilometer contracts.
- Converting weather wind speed or any non-eBird unit.
- An arbitrary redirect endpoint or any client-selected launch URL.
- Exposing or hard-coding private SnowRaven, llmdash, Hephaestus, coordinate, credential, or bookmark values.
- A new widget, a third presentation mode, user accounts, public-internet exposure, or a redesign of Dawn or Dense.
- Relaxing the one-screen release contract for the normal desktop or mobile payload.

## QA Acceptance Matrix

| ID | Requirements | Verification | Pass Condition |
| --- | --- | --- | --- |
| QA-01 | FR-01, FR-20, FR-21 | Render both modes from one application session. | Dawn and Dense each show one Kagi form in shared chrome; switching modes neither duplicates the form nor loses its current input value, and no new widget appears. |
| QA-02 | FR-02, NFR-01 | Exercise a fresh mount and subsequent dashboard interactions with focus assertions. | The input has focus after initial mount exactly once; mode, appearance, category, refresh, location, and async source updates preserve the user's current focus. |
| QA-03 | FR-03, FR-04 | Submit representative queries through Enter and the submit control while intercepting navigation. | `sandhill crane` navigates in the same tab to Kagi with one correctly encoded `q` value; empty and whitespace-only values produce no navigation or Kagi request. |
| QA-04 | FR-05, NFR-07 | Type without submitting and inspect browser storage, requests, and client logs. | No Kagi request, prefetch, persisted query, analytics event, or logged query appears before explicit submission; adding the form does not block source rendering. |
| QA-05 | FR-06, NFR-01 | Inspect semantics and complete keyboard-only and touch-equivalent search flows. | The input has a Kagi-specific accessible name, the submit control has an unambiguous name, Enter and explicit activation both work, focus is visible, and automated accessibility checks find no new violation. |
| QA-06 | FR-07, FR-14, FR-20 | Render a month summary in both modes and inspect/activate its link. | Both presentations expose equivalently named My eBird links using ordinary same-tab anchor behavior and resolving only to the fixed My eBird destination. |
| QA-07 | FR-08, FR-09, FR-14, FR-20 | Render lifer, photo, and audio fixtures containing punctuation-heavy names and valid species codes. | Every rendered target is keyboard-linkable in both modes; each accessible name identifies the species; its destination uses the canonical code and is unchanged by name, locality, or date. |
| QA-08 | FR-11, FR-12, NFR-05 | Send valid, missing, malformed, encoded, and URL-like identifiers to launch actions and inspect redirects and security headers. | Only named actions redirect; valid codes resolve beneath the fixed eBird map base; invalid inputs receive a non-redirecting 4xx response; no request parameter can supply a scheme, host, or absolute destination. |
| QA-09 | FR-10, FR-13, FR-14, FR-20, NFR-08 | Render llmdash loading, fresh, stale, partial, and error states with valid, missing, and invalid launch settings. | A valid configured destination remains linkable in both modes and every data state; missing or invalid configuration fails safely without a redirect or disruption to llmdash data and the rest of the dashboard. |
| QA-10 | FR-13, FR-15, NFR-06 | Review configuration parsing, example files, installer/update behavior, documentation, production bundle, and changed-file secret scan. | Launch and fetch URLs are distinct validated settings; private values survive deployment updates as intended; tracked examples contain placeholders only; no real private value is present in client or repository output. |
| QA-11 | FR-16, FR-19 | Compare server requests, normalized responses, caching behavior, and target selection before and after the feature. | Requests and contracts remain in kilometers and controlled fixtures produce identical category membership, target caps, deduplication, ordering, and tie-break results. |
| QA-12 | FR-17 | Unit-test conversion and formatting at null, zero, below/at/above 10-mile rounding boundaries, and the 50 km default radius. | Results use `0.621371`; values below 10 miles have one decimal, values from 10 miles have no decimal, null remains `distance unknown`, and 50 km displays as `31 mi`. |
| QA-13 | FR-18, FR-20 | Render every target category and radius context in Dawn and Dense. | All visible eBird distance and radius strings use `mi` or `miles`, no eBird `km` copy remains, and the values agree between presentations. |
| QA-14 | FR-22, NFR-08 | Run the established unit/integration suite plus controlled source failures after using each new action. | Preferences, location fallback/retry, refresh, target tabs, stale/error states, source isolation, and bookmark ordering retain their prior behavior; launch failures do not crash or block them. |
| QA-15 | NFR-01, NFR-04 | Run automated accessibility checks and manual keyboard/mobile-browser smoke tests across the supported browser matrix. | The complete flows work in current/previous Safari, Chrome, and Firefox and mobile Safari; logical focus and visible focus remain intact with no color-only destination cue. |
| QA-16 | NFR-02 | Run full-payload visual and layout assertions at 1440×900 and 360×800 in both modes and all appearances. | `scrollWidth` does not exceed viewport width, document height does not exceed viewport height, and the search, links, existing controls, five targets, five bookmarks, and essential values remain visible without collision. |
| QA-17 | NFR-03, NFR-04 | Exercise a shorter viewport, open mobile software keyboard, and render oversized target/bookmark fixtures. | Existing bounded source regions remain reachable, no competing document-scroll trap or horizontal overflow appears, and the focused search field and submit action remain usable. |
| QA-18 | NFR-05 | Inspect the production Content Security Policy and attempt disallowed script, connect, frame, object, and form/navigation destinations. | Required Kagi and constrained launch flows work, while all unrelated external sources and arbitrary form destinations remain blocked at least as strictly as before. |
| QA-19 | NFR-06 | Inspect the production bundle, HTML, network-visible dashboard API payloads, and client diagnostics. | None exposes a private launch/upstream hostname, credential, coordinate, real bookmark beyond its existing authorized UI use, or newly logged query. |
| QA-20 | NFR-07 | Compare shell and widget timing with the established performance fixture and idle-network capture. | The existing shell target is not materially regressed, no destination lookup is required to render widget data, and no new background request occurs before user activation. |

## Release Criteria

- QA-01 through QA-20 pass in the supported local/tailnet deployment shape.
- All FR and NFR IDs are covered by at least one QA acceptance row.
- The real llmdash launch destination is supplied only in private deployment configuration and verified on the target host.
- Dawn and Dense pass the normal-payload one-screen checks at both required viewport sizes.
