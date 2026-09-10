# PRD — eBird Distance and Sort Preference
**Feature:** ebird-distance-and-sort-preference
**Date:** 2026-09-10
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview

Homedash narrows the standard nearby eBird target area to ten miles and adds one device-local choice between nearest-first and most-recent-first ordering. The choice applies immediately to the existing Birding pulse in Dawn and Dense without adding a source, page, or server-owned user preference.

## User Stories

> **US-01** — As the owner scanning nearby lifers, I want results limited to a genuinely local area, so that every displayed destination is practical enough to consider now.

> **US-02** — As the owner deciding where to go, I want to switch between nearest and most recent reports, so that I can prioritize travel distance or timeliness for the moment.

> **US-03** — As a user of Lifers, Photo, and Audio targets, I want one consistent order choice, so that changing category or presentation does not silently change what “top” means.

> **US-04** — As someone who uses Homedash across several devices, I want each browser to remember its own target order, so that phone and desktop can keep the view that suits them.

> **US-05** — As the owner relying on saved-first data, I want sorting to remain available without another upstream refresh, so that the Birding pulse stays immediate and resilient.

## Functional Requirements

### Radius and eligibility

> **FR-01** — A standard Homedash installation shall request nearby eBird observations within no more than 16.1 kilometers and shall describe that area to the user as `within 10 mi`.

> **FR-02** — An update from the prior installer-managed 50-kilometer default shall adopt the new ten-mile standard automatically.

> **FR-03** — An explicitly customized host radius that differs from the prior managed default shall remain authoritative and shall not be overwritten during update.

> **FR-04** — Radius shall remain private server configuration; no browser control shall select or submit an arbitrary radius to SnowRaven.

### Target ordering

> **FR-05** — The Birding pulse shall offer exactly two target orders: `Nearest` and `Recent`.

> **FR-06** — `Nearest` shall order known distances from smallest to largest, break equal-distance ties by newer observation time, place unknown distances after every known distance, and use canonical species code as the final stable tie-breaker.

> **FR-07** — `Recent` shall order observation times from newest to oldest, break equal-time ties by known distance from smallest to largest with unknown distance last, and use canonical species code as the final stable tie-breaker.

> **FR-08** — Duplicate reports for one canonical species shall collapse before the five-target cap: `Nearest` shall retain the nearest report with recency as its tie-breaker, while `Recent` shall retain the newest report with distance as its tie-breaker; exact duplicate ties shall use locality and then common name in ascending code-point order so provider row order never decides the result.

> **FR-09** — Each order shall select its five displayed targets from the complete validated and category-eligible nearby pool; the app shall not obtain `Recent` by merely reordering the five nearest targets.

> **FR-10** — The chosen order shall apply equally to Lifers, Photo, and Audio without changing category eligibility or availability.

> **FR-11** — Empty, partial, and unavailable target categories shall retain their existing behavior in either order.

> **FR-12** — The server response shall provide enough validated, bounded data for both complete five-target orders so switching order does not require another SnowRaven request.

### Interaction and persistence

> **FR-13** — Dawn and Dense shall each expose the order choice inside the existing Birding pulse, adjacent to the target-category controls and before the target list in reading order.

> **FR-14** — The selected control shall expose its state programmatically, remain keyboard-operable, and have an accessible group name that distinguishes target order from target category.

> **FR-15** — Choosing an order shall update the visible target list immediately without reloading the page, changing the selected target category, or starting an eBird source refresh.

> **FR-16** — One order choice shall be shared between Dawn and Dense and shall survive switching presentation or appearance.

> **FR-17** — The order choice shall persist in the existing per-browser preference record and shall not be sent to or stored by the server.

> **FR-18** — A browser with no saved order, an older valid preference record, or an invalid saved order shall use `Nearest` while preserving any independently valid saved view and appearance values.

> **FR-19** — If browser storage refuses a change, the selected order shall still apply for the current visit and the app shall announce that it could not retain the choice.

> **FR-20** — A successful order change shall announce the chosen target order without moving focus away from the activating control.

### Shared state and failure behavior

> **FR-21** — Dawn and Dense shall derive their visible targets from the same normalized eBird envelope and the same browser preference; neither renderer shall fetch or independently reinterpret upstream data.

> **FR-22** — Saved eBird snapshots shall preserve the complete bounded data required for both orders and shall remain schema-validated before rendering.

> **FR-23** — eBird loading, retry, stale, partial, and error behavior shall remain source-local and independent of the selected order.

> **FR-24** — Global refresh, location refresh, and eBird-only retry shall refresh the shared data for both orders once; changing order alone shall make no network request.

> **FR-25** — Existing eBird map launch links shall keep the same constrained same-origin destinations and shall reflect the report retained for the active order.

### Installation and compatibility

> **FR-26** — New `.env` files and the public example shall carry the new ten-mile-equivalent radius without exposing private coordinates or changing other host configuration.

> **FR-27** — Updating an existing `.env` shall preserve its permissions, unrelated values, and formatting outside the narrowly recognized prior managed radius value.

> **FR-28** — Existing target-category behavior, five-target display cap, monthly comparison, source freshness, and SnowRaven authority shall remain unchanged.

## Non-Functional Requirements

> **NFR-01 — Accessibility:** Both order choices shall have visible text, programmatic selected state, logical keyboard behavior, and an announcement that does not rely on color alone.

> **NFR-02 — Touch:** Each mobile order control shall meet the existing 44×44 CSS-pixel interactive baseline without overlapping the target-category controls or links.

> **NFR-03 — Responsive layout:** The normal five-target/five-bookmark payload shall remain free of document scrolling at 1440×900 and 360×800 in Dawn and Dense; exceptional overflow shall remain inside the affected source region.

> **NFR-04 — Performance:** Switching order shall be browser-local and shall not contact Homedash, SnowRaven, or eBird; rendering shall remain effectively immediate for the bounded response.

> **NFR-05 — Determinism:** Both sort orders and duplicate selection shall produce the same output for the same normalized input regardless of provider row order.

> **NFR-06 — Privacy:** The sort preference shall remain per-browser, and the feature shall add no coordinates, target preference, or private configuration to browser URLs, server logs, or third-party requests.

> **NFR-07 — Security:** Radius and upstream destinations shall remain server-owned and all target data shall pass the existing strict shared contract before entering storage or either renderer.

> **NFR-08 — Compatibility:** Existing preference records and standard installer-created `.env` files shall migrate safely without requiring a database, browser extension, or manual reset.

> **NFR-09 — Testability:** Radius migration, both comparators, sort-aware deduplication, cap ordering, preference migration/failure, renderer parity, no-request switching, accessibility, and viewport containment shall have automated coverage.

## Out of Scope

- Separate sort choices per category, view, device class, or location.
- Saving target category, arbitrary radius selection, additional sort modes, filters, maps, alerts, or sighting history.
- Changing the five-target display cap, eBird monthly comparison, SnowRaven ownership, or the constrained map-launch boundary.
- A server-side preference, cross-device synchronization, database, analytics, or public-internet access.
- Codex access to or changes on the production host.

## Open Questions

None — all decisions are resolved in this document. `Nearest` is the backward-compatible default, one choice spans every target category and renderer, both complete orders arrive in one bounded eBird envelope, and order changes are local with no refresh.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Standard radius | A new or prior-default installation requests no more than 16.1 km and both renderers show `within 10 mi`. |
| QA-02 | Custom radius preservation | An existing non-default configured radius is byte-for-byte unchanged by the updater. |
| QA-03 | Nearest order | Known distances ascend, equal distances use newer time, unknown distances are last, and the final tie-break is stable. |
| QA-04 | Recent order | Observation times descend, equal times use nearer known distance, unknown distances are last for the tie, and the final tie-break is stable. |
| QA-05 | Sort-aware deduplication | Duplicate species retain the nearest report for `Nearest` and newest report for `Recent`. |
| QA-06 | Cap after ordering | A recent report outside the five nearest can appear in the five `Recent` results, while each category/order remains capped at five. |
| QA-07 | Category parity | Lifers, Photo, and Audio use the same selected order without changing availability behavior. |
| QA-08 | Renderer parity | Dawn and Dense show the same ordered targets and selected order from one state. |
| QA-09 | Immediate local switch | Selecting the other order changes the list without a page reload, eBird loading state, or network request and retains the active category and focus. |
| QA-10 | Persistence | The selected order survives reload and view/appearance changes in the same browser but is absent from API payloads. |
| QA-11 | Preference migration | Missing, legacy, or invalid order data defaults to `Nearest` without discarding valid saved view and appearance. |
| QA-12 | Storage failure | The order changes for the current visit and an accessible announcement says it could not be retained. |
| QA-13 | Saved-first and refresh | A validated saved eBird envelope supports both orders before live refresh; global, location, and retry paths refresh it once without changing preference. |
| QA-14 | Accessibility and touch | Order controls expose a named selected state, work by keyboard, and meet the mobile 44×44 target baseline without overlap. |
| QA-15 | Responsive acceptance | Both orders and all categories remain contained at 1440×900 and 360×800 in Dawn/Dense and System/Light/Dark. |
| QA-16 | Regression | Monthly progress, source states, map launches, target caps, other widgets, and existing preferences remain green. |
