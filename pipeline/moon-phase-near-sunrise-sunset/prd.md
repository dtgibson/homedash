# PRD — Moon Phase Near Sunrise and Sunset
**Feature:** `moon-phase-near-sunrise-sunset`  
**Date:** 2026-09-09  
**Stage:** 2 — The Planner  
**Source:** `strategic-brief.md` (approved)

## Feature Overview

Homedash will add the current qualitative moon phase as compact day context beside the existing sunrise, sunset, and daylight treatment in Dawn and Dense. The feature will use one deterministic, accessible phase meaning across both presentations without adding a data source, widget, configuration surface, or precision claim.

## User Stories

> **US-01** — As the owner checking the day ahead, I want to see the current moon phase beside sunrise, sunset, and daylight, so that I can answer the adjacent lunar question at the same glance.

> **US-02** — As the owner switching between Dawn and Dense, I want the same phase meaning in either presentation, so that mode choice changes presentation rather than information.

> **US-03** — As a screen-reader user, I want the phase stated with an ordinary qualitative name, so that I do not have to interpret a moon glyph, shape, or color.

> **US-04** — As the owner opening a saved dashboard reading, I want the moon phase to describe the current time rather than the cached weather observation, so that stale weather does not produce stale lunar context.

> **US-05** — As the owner during a weather delay or failure, I want moon calculation and weather state to remain independent, so that neither can block or mislabel the other.

> **US-06** — As the owner leaving homedash open across a phase or date boundary, I want the qualitative phase to update when it becomes outdated without continuous ticking, so that the page stays current and quiet.

> **US-07** — As the owner using homedash on phone and desktop, I want the additional context to preserve the one-screen layout and existing actions, so that the start page remains immediately useful.

## Functional Requirements

### Phase Meaning and Time Semantics

> **FR-01** — The app shall expose exactly one of these eight canonical phase labels for every valid phase result: `New moon`, `Waxing crescent`, `First quarter`, `Waxing gibbous`, `Full moon`, `Waning gibbous`, `Last quarter`, or `Waning crescent`.

> **FR-02** — The app shall classify a normalized lunar-cycle position using lower-inclusive and upper-exclusive bands: `New moon` for `[15/16, 1)` and `[0, 1/16)`, `Waxing crescent` for `[1/16, 3/16)`, `First quarter` for `[3/16, 5/16)`, `Waxing gibbous` for `[5/16, 7/16)`, `Full moon` for `[7/16, 9/16)`, `Waning gibbous` for `[9/16, 11/16)`, `Last quarter` for `[11/16, 13/16)`, and `Waning crescent` for `[13/16, 15/16)`; an exact boundary shall belong to the band that begins at that boundary.

> **FR-03** — “Current moon phase” shall mean the phase at the device's current wall-clock instant when the value is evaluated. The browser's local time zone shall govern local-date rollover scheduling only; weather location, weather time zone, sunrise or sunset date, and cached `generatedAt` or `sourceUpdatedAt` values shall not select the evaluation instant.

> **FR-04** — The app shall derive one shared phase result for an evaluation instant and shall use that result in both Dawn and Dense, so a presentation or appearance change cannot independently reclassify or relabel the same instant.

> **FR-05** — The app shall evaluate the phase on initial page display and re-evaluate it when the next qualitative phase-band boundary is reached, when the browser's local calendar date changes, when the document becomes visible after either may have passed, and when an existing weather or global refresh settles. It shall not require a continuously ticking seconds- or minutes-based update.

> **FR-06** — Phase derivation shall be deterministic and local to the existing application. It shall not make a network request, call a new upstream or API, register a fifth dashboard source, create a moon-specific cache or snapshot, or add a moon-specific refresh, retry, loading, stale, or error control.

### Presentation and Accessibility

> **FR-07** — Dawn shall show the canonical phase label within the existing sun/daylight treatment, visually adjacent to its sunrise, sunset, and daylight information, without adding a card, widget, source region, or independent row.

> **FR-08** — Dense shall show the canonical phase label in the existing weather/daylight content, adjacent to the sunrise, sunset, and daylight copy, without adding a dashboard row, source region, or separate status line.

> **FR-09** — Dawn and Dense shall expose the same canonical phase label and equivalent meaning for the same shared result across System, Light, and Dark appearances.

> **FR-10** — The canonical text label shall be the authoritative visible and assistive-technology-accessible phase meaning. Any moon glyph, illustration, or shape shall be optional, shall agree with the text label, and shall be hidden from assistive technology when it duplicates that text.

> **FR-11** — Phase presentation shall remain qualitative: it shall not display or imply illumination percentage, lunar age, phase angle, exact boundary time, countdown, visibility, moonrise, moonset, or ephemeris-grade precision.

### Independence, Failure, and Existing Behavior

> **FR-12** — When the device supplies a valid current time and a valid phase can be derived, the phase shall remain available in its established weather/daylight context while weather is loading, refreshing, stale, partially available, or unavailable; it shall not be presented as a weather reading.

> **FR-13** — If the current time is invalid or phase derivation produces no valid canonical result, the app shall omit the phase label and any phase glyph rather than show a default, previous, contradictory, or `unknown` phase. That failure shall not throw through a view, change weather values or state, suppress sunrise/sunset/daylight, or add a new error surface.

> **FR-14** — Adding the phase shall leave weather location selection and provenance, Open-Meteo attribution, browser snapshot hydration, freshness and age copy, last-good-value preservation, independent source settlement, manual and source retry behavior, and the `0–4 of 4` visibility/refresh model unchanged.

> **FR-15** — Existing HTTP routes, methods, request shapes, response schema versions, and browser storage keys shall remain backward compatible. The Architect may define only the minimal shared moon-phase representation needed for one result across application layers; it shall not require another endpoint, source, cache key, or control, and existing cached weather envelopes that lack that representation shall remain valid.

> **FR-16** — The phase shall not use, reveal, expand, or relabel device coordinates, Home fallback coordinates, private host configuration, credentials, or upstream addresses, and it shall not inherit Open-Meteo attribution or weather-location provenance.

> **FR-17** — Existing sunrise, sunset, daylight duration, next-daylight-event, and sun-arc meanings and calculations shall remain unchanged; the phase shall supplement rather than replace, reorder, or reinterpret them.

> **FR-18** — Existing Dawn/Dense and appearance preferences, Kagi search, eBird and llmdash launch links, bookmarks, target selection, focus behavior, routes, and keyboard and touch interactions shall continue to operate unchanged.

> **FR-19** — The feature shall not add a setting, notification, background polling workflow, third display mode, dashboard source badge, or user action.

## Non-Functional Requirements

> **NFR-01 — Determinism and coarse accuracy:** The documented calculation shall use a fixed reference epoch and mean synodic-period constant, map all valid instants to a normalized cycle position, remain stable across supported browsers, and correctly classify the approved known-date fixtures; it shall be described as a qualitative approximation rather than astronomical-event precision.

> **NFR-02 — Accessibility:** Phase text shall occur in the logical reading order of the existing daylight context, remain available at 200% text zoom, meet WCAG 2.2 AA contrast in both modes and every appearance, and never depend on color, shape, animation, or an unlabeled glyph for meaning.

> **NFR-03 — Required viewport fit:** With the normal five-target/five-bookmark payload, Dawn and Dense shall have no horizontal overflow, no document scrolling, no clipped or internally overflowing source region, and no obscured essential content at 1440×900 and 360×800 CSS pixels in System, Light, and Dark appearances.

> **NFR-04 — Bounded overflow compatibility:** At shorter viewports or with payloads larger than the normal fixture, existing source-owned bounded overflow shall remain reachable and the moon treatment shall not create a competing document-level scroll region or scroll trap.

> **NFR-05 — Performance and lifecycle:** Phase derivation and scheduled re-evaluation shall not materially delay the usable shell or widget rendering, trigger React update churn while the value is unchanged, or introduce recurring high-frequency work, background network traffic, or refresh contention.

> **NFR-06 — Reduced motion:** The phase shall require no animation. If supplementary motion or transition is used, it shall stop or become effectively instantaneous under `prefers-reduced-motion: reduce` and shall not be necessary to perceive the label.

> **NFR-07 — Privacy and security:** The feature shall add no credential, private configuration, client-visible coordinate, upstream host, executable markup, or broadened Content Security Policy permission; changed artifacts and production output shall remain free of new sensitive values.

> **NFR-08 — Compatibility:** Phase meaning, lifecycle updates, and accessibility shall work in the current and previous major releases of Safari, Chrome, and Firefox, including mobile Safari, using the existing supported date/runtime environment.

> **NFR-09 — Resilience and testability:** Phase classification, time lifecycle, presentation parity, failure isolation, accessibility, and viewport fit shall be independently testable with controlled clocks and data fixtures, without live weather, geolocation, network access, or the actual current lunar phase.

## Out of Scope

- Moonrise, moonset, lunar transit times, or changes to sunrise, sunset, daylight duration, next-daylight-event, or sun-arc calculations.
- Illumination percentage, lunar age, phase angle, distance, azimuth, altitude, visibility, exact boundary timestamps, or other astronomical-event precision claims.
- Phase history, calendars, past or future phase browsing, forecasts, event dates, countdowns, or astronomy dashboards.
- Astrology, zodiac content, horoscopes, or interpretive moon guidance.
- Notifications, alerts, reminders, calendar integration, or background polling for lunar events.
- New settings, phase-detail controls, hemisphere controls, location controls, geolocation expansion, or a third display mode.
- A fifth widget or data source, separate moon card or row, source badge, cache or snapshot, loading/error/stale state, retry control, refresh control, or source-progress change.
- A new astronomy API, upstream service, runtime service, or third-party dependency. A dependency may be reconsidered only if the Architect documents that the existing stack cannot satisfy the approved deterministic coarse calculation; that evidence does not authorize an external network source or broader product scope.
- New private configuration, credentials, permissions, analytics, telemetry, or public-internet exposure.
- Redesigning Dawn or Dense, changing weather provenance or attribution, changing existing modes/preferences, changing Kagi or launch-link behavior, or relaxing the one-screen layout contract.

## Open Questions

None — all decisions are resolved in this document.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | FR-01, FR-02, NFR-01 — canonical vocabulary and known-date classification | Controlled UTC fixtures classify as follows: `2024-04-08T18:21:00Z` New moon, `2024-04-12T12:00:00Z` Waxing crescent, `2024-04-15T19:13:00Z` First quarter, `2024-04-19T12:00:00Z` Waxing gibbous, `2024-04-23T23:49:00Z` Full moon, `2024-04-27T12:00:00Z` Waning gibbous, `2024-05-01T11:27:00Z` Last quarter, and `2024-05-05T00:00:00Z` Waning crescent; no other label is returned. |
| QA-02 | FR-02, NFR-01, NFR-09 — all band boundaries and wraparound | For every boundary from `1/16` through `15/16`, values immediately below, exactly at, and immediately above select the preceding, new, and new bands respectively; values around `0/1` wrap to New moon; repeated and cross-browser runs return identical labels. |
| QA-03 | FR-03 — current-instant semantics | With the device clock fixed, changing browser time zone, weather location/time zone, sunrise/sunset date, and fresh or prior-day cached metadata does not change the label for that instant; advancing the fixed device clock to a different band changes it to the expected current label. |
| QA-04 | FR-04, FR-09 — renderer and appearance parity | For each of the eight phase fixtures, Dawn and Dense expose the same canonical label from one application session under System resolving light, System resolving dark, explicit Light, and explicit Dark; switching presentation or appearance at a fixed instant does not create a second or contradictory result. |
| QA-05 | FR-05, NFR-05 — update lifecycle without ticking | With fake timers, the phase is evaluated on initial display, at the next band boundary, at local midnight, after a hidden document resumes past either boundary, and after successful or failed existing weather/global refresh settlement; it is not polled every second or minute and unchanged results do not cause repeated view updates. |
| QA-06 | FR-06, NFR-05 — no new source or lifecycle | An idle-load and manual-refresh network capture contains only the established dashboard requests; the UI and storage contain four sources, existing snapshot keys, and existing refresh/retry controls, with no moon endpoint, request, cache, state badge, progress increment, or control. |
| QA-07 | FR-07 — Dawn placement | Every canonical label renders inside Dawn's existing sun/daylight treatment beside visible sunrise, sunset, and daylight information; no additional card, widget, source region, or independent row appears. |
| QA-08 | FR-08 — Dense placement | Every canonical label renders in Dense's existing weather/daylight content beside sunrise, sunset, and daylight copy; the Dense grid retains its established rows and source regions with no new status line. |
| QA-09 | FR-10, NFR-02, NFR-06 — authoritative accessible text | Accessibility-tree inspection and keyboard/screen-reader review find the canonical label in the daylight reading order in both modes; any supplementary glyph matches the label and has no duplicate accessible exposure; the meaning survives glyph/CSS removal, 200% text zoom, high-contrast review, and reduced-motion mode with no new automated accessibility violation. |
| QA-10 | FR-11 — qualitative claim boundary | Rendered text, accessible names, titles, data labels, and user-facing diagnostics contain only the canonical qualitative label and do not expose illumination, age, angle, boundary time, countdown, visibility, moonrise/moonset, or precision language. |
| QA-11 | FR-12, NFR-09 — independence from weather availability | With a valid fixed clock, the expected phase remains available in its weather/daylight context through empty loading, cached-stale, refreshing, refresh-failed-with-saved-value, partial, and no-weather error fixtures; it is never counted or described as an Open-Meteo/weather reading. |
| QA-12 | FR-13, NFR-09 — invalid-time and derivation failure isolation | Invalid-date, non-finite-cycle, and forced derivation-failure fixtures render no phase text or glyph and no `unknown`, prior, or default phase; both views continue rendering their exact weather/loading/error fixture without an uncaught error, altered value/state, suppressed daylight content, or new error surface. |
| QA-13 | FR-14, NFR-09 — cached refresh and source-state regression | Existing cache hydration, age/freshness copy, last-good retention, independent source settlement/retry, location fallback/provenance, and manual refresh tests remain green; visible and refresh progress remains `0–4 of 4` in both modes for success and mixed-failure sequences. |
| QA-14 | FR-15 — route, contract, and cache backward compatibility | Existing route/method/request/response contract tests pass unchanged; a pre-feature valid weather snapshot hydrates successfully; any Architect-defined shared phase representation is minimal and backward compatible and creates no endpoint, required legacy-payload field, source, cache key, or control. |
| QA-15 | FR-16, NFR-07 — privacy, attribution, and security | Phase output is unchanged across current, last-known, and Home location selectors and contains no coordinates or location label; Open-Meteo attribution remains attached only to weather; changed-file, production-bundle, storage, API-payload, and CSP review finds no new secret, private host/configuration, coordinate exposure, executable content, or policy expansion. |
| QA-16 | FR-17 — daylight calculation regression | Existing sunrise, sunset, daylight duration, next-daylight-event, and sun-arc progress fixtures produce the same values, accessible meanings, ordering, and visual states before and after the feature while the phase appears only as supplementary content. |
| QA-17 | FR-18, FR-19 — established interaction and scope regression | Existing tests for mode/appearance persistence, Kagi submission and focus, launch destinations, bookmarks, targets, refresh/retry focus, keyboard and touch behavior, and route handling remain green; inspection finds no phase setting, action, notification, polling workflow, third mode, or additional badge. |
| QA-18 | NFR-03, NFR-04 — desktop/mobile fit and bounded overflow | With five targets and five bookmarks, both modes in every appearance at 1440×900 and 360×800 satisfy `scrollWidth <= clientWidth` and `scrollHeight <= clientHeight` for the document and every established source region, with all essential values unobscured; shorter and oversized fixtures retain only the established reachable source-owned overflow and introduce no document scroll trap. |
| QA-19 | NFR-05, NFR-06, NFR-08 — performance, motion, and browser compatibility | Current and previous Safari, Chrome, and Firefox plus mobile Safari render the correct label and pass lifecycle checks; idle inspection shows no new network traffic, recurring high-frequency timer, refresh contention, or phase-related update churn, and reduced-motion inspection shows no required or continuous phase motion. |
