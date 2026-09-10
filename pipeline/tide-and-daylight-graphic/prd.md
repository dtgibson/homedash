# PRD — Tide and Daylight Graphic
**Feature:** tide-and-daylight-graphic
**Date:** 2026-09-09
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview
Homedash adds one independently refreshed local-tide reading and presents it with sunrise, sunset, and moon phase as a single day story. Dawn uses a full compact graphic; Dense uses the same facts with a restrained inline trace.

## User Stories

> **US-01** — As the owner checking Homedash in the morning, I want to see the current tide height and direction, so that I understand the water state without opening another app.

> **US-02** — As the owner planning time outside, I want to see the next high or low tide with sunrise and sunset, so that I can read the useful windows of the day together.

> **US-03** — As a Dawn user, I want the tide and daylight shown graphically, so that the shape of the day is clear at a glance.

> **US-04** — As a Dense user, I want the same tide meaning in a compact form, so that choosing density never removes information.

> **US-05** — As the owner relying on several private sources, I want tide failures isolated and honestly labeled, so that weather, daylight, and moon context remain useful.

## Functional Requirements

### Tide data and meaning

> **FR-01** — The app shall load tide data for one station selected in private server configuration; the browser shall not select or submit a station.

> **FR-02** — The tide response shall identify the station with a human-readable label and shall not expose configured coordinates.

> **FR-03** — The app shall provide the latest current water level in feet, its source time, and whether the value is observed or predicted.

> **FR-04** — An observation no more than 60 minutes old shall be presented as observed current water level; when no eligible observation exists but predictions do, the app shall present an interpolated current prediction labeled `predicted`.

> **FR-05** — The current tide shall be labeled `rising`, `falling`, or `near slack`; a change of less than 0.05 feet across the latest eligible comparison shall count as near slack.

> **FR-06** — The app shall identify the next predicted high or low strictly after the current time and show its local time and predicted height in feet.

> **FR-07** — The tide response shall include validated prediction points covering the station's current local calendar day, plus enough of the following day to resolve the next turn after late-evening loads.

> **FR-08** — Observed and predicted values shall be visually and textually distinguishable; the app shall never present a prediction as a measured observation.

### Dawn presentation

> **FR-09** — Dawn shall place tide inside the existing daylight context rather than creating a separate equal-weight widget.

> **FR-10** — Dawn shall draw a continuous day-scale tide curve with the current point, the next high/low, a now marker, and sunrise/sunset markers when those daylight values are available.

> **FR-11** — Dawn shall show text for current height, observed/predicted status, direction, next turn, source time, and station label adjacent to the graphic.

> **FR-12** — The existing moon-phase label shall remain visible with the combined daylight and tide story without implying that moon phase alone predicts the local tide.

### Dense presentation

> **FR-13** — Dense shall show current tide height and provenance, direction, next turn, station, and freshness in its scanning row language.

> **FR-14** — Dense shall include a compact inline tide trace with current and next-turn markers while keeping the text as the authoritative meaning.

> **FR-15** — Dawn and Dense shall consume the same normalized tide state and shall not fetch, reorder, or reinterpret the source independently.

### Refresh, saved state, and failure

> **FR-16** — Tide shall have its own loading, ready, refreshing, partial, stale, and error states independent of weather, bookmarks, eBird, and llmdash.

> **FR-17** — A valid browser-owned last-good tide snapshot shall render before live refresh settles, remain visible during refresh, and be replaced only by a validated tide response.

> **FR-18** — A failed tide refresh shall retain eligible last-good tide data with its age and failure state; without a valid snapshot it shall show a tide-specific unavailable message and retry action.

> **FR-19** — Predicted tide data may remain visible when the latest observation is unavailable, with the current value labeled predicted and the partial state explained.

> **FR-20** — Tide failure or delay shall not suppress, blank, or delay weather, sunrise/sunset, moon phase, or any other dashboard source.

> **FR-21** — The global refresh action shall include tide as a fifth independent source, update its accessible name and progress total, and settle each source in place.

> **FR-22** — Retrying tide shall request only the tide source; global and location refreshes shall include tide when a usable current, last-known, or Home location is selected only if the server configuration requires that location for source resolution.

### Privacy and source integrity

> **FR-23** — The browser shall call only a same-origin Homedash endpoint; all tide-provider requests and credentials or station configuration shall remain server-side.

> **FR-24** — Provider responses shall be schema-validated before caching or returning, and malformed, oversized, non-finite, or chronologically invalid points shall fail closed without replacing last-good state.

> **FR-25** — The app shall use a fixed provider destination and bounded request behavior; no browser value may choose the upstream host, path, station, or datum.

## Non-Functional Requirements

> **NFR-01 — Accessibility:** Every graphical value shall have an equivalent nearby text value; direction and availability shall not rely on color alone, and decorative chart paths shall not create duplicate screen-reader output.

> **NFR-02 — Contrast:** Tide curves, markers, labels, and focus states shall meet the established Homedash contrast rules in light and dark appearances.

> **NFR-03 — Responsive layout:** The normal payload shall preserve the no-document-scroll targets at 1440×900 and 360×800 in Dawn and Dense; exceptional overflow shall remain bounded to the affected source region.

> **NFR-04 — Performance:** Tide work shall run concurrently with other sources, use the existing bounded upstream timeout, and never extend another source's loading lifecycle.

> **NFR-05 — Freshness:** Source time, snapshot age, refreshing, up-to-date, partial, stale, and failed states shall follow the existing source-freshness language.

> **NFR-06 — Security:** Exact device and Home coordinates, private configuration, and upstream details shall not appear in browser URLs, responses, or logs.

> **NFR-07 — Motion:** Any current-point or refresh transition shall remain under 300ms, explain a state change, and honor reduced-motion preferences; the tide curve shall not pulse, shimmer, or animate decoratively on mount.

> **NFR-08 — Compatibility:** The feature shall work in the project's supported Chromium desktop and mobile viewports without requiring a database or browser extension.

> **NFR-09 — Testability:** Provider normalization, fallback semantics, direction thresholds, next-turn selection, saved-state behavior, renderer parity, accessibility text, and viewport containment shall have automated coverage.

## Out of Scope

- Browser station search, station selection, maps, or arbitrary provider URLs.
- Tide alerts, notifications, historical comparison, favorites, or calendars.
- Currents, waves, swell, marine forecasts, water temperature, or boating guidance.
- A database or retained tide history beyond the existing bounded caches and last-good snapshot.
- Replacing the current weather daylight values or local moon-phase calculation.
- Production access or changes performed by Codex.

## Open Questions

None — all decisions are resolved in this document. The station is private server configuration, feet are the display unit, the configured provider's standard local datum is labeled in source metadata, and observations fall back to clearly labeled predictions.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Private station ownership | The browser cannot select a station or provider; one configured station label is returned without coordinates. |
| QA-02 | Current tide value | An eligible observation displays height, source time, `observed`, and the correct rising/falling/near-slack label. |
| QA-03 | Predicted fallback | With no eligible observation and valid predictions, a current interpolated value appears labeled `predicted`. |
| QA-04 | Direction threshold | Changes below 0.05 feet resolve to near slack; larger positive/negative changes resolve to rising/falling. |
| QA-05 | Next turn | The first predicted high or low after now displays with correct local time and height, including late-evening rollover. |
| QA-06 | Dawn graphic | Dawn shows the tide curve, now/current marker, next-turn marker, available sunrise/sunset markers, and authoritative text. |
| QA-07 | Dense parity | Dense exposes the same current value, provenance, direction, next turn, station, freshness, and an inline trace. |
| QA-08 | Moon wording | Moon phase remains visible without text claiming it determines the local tide. |
| QA-09 | Independent failure | Tide loading/error/partial states do not blank or delay weather, daylight, moon, or other sources. |
| QA-10 | Saved-first refresh | A valid last-good tide snapshot renders during refresh and survives a failed refresh with honest age/state. |
| QA-11 | Refresh behavior | Global refresh names and tracks five sources; tide-only retry requests only tide. |
| QA-12 | Validation | Malformed or invalid provider data is rejected and never replaces valid cached state. |
| QA-13 | Privacy and destination | No coordinates or private station configuration enter browser URLs/logs; upstream destination is fixed server-side. |
| QA-14 | Accessibility | All graphic meaning is available as text and no status depends on color alone. |
| QA-15 | Responsive acceptance | Dawn and Dense remain contained at 1440×900 and 360×800 in light and dark appearances. |
| QA-16 | Regression | Existing weather, daylight, moon, refresh, caching, and appearance/view behavior remains green. |
