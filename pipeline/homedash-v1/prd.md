# PRD — homedash v1

**Feature:** homedash-v1
**Date:** 2026-09-07
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview

Homedash v1 is a locally hosted, mobile-friendly browser start page with Dawn and Dense presentations over one shared data set. It brings location-aware weather and daylight, configured bookmarks, eBird targets and monthly progress, and llmdash quota headroom into one glanceable page available across the user’s tailnet devices.

## User Stories

> **US-01** — As the owner opening homedash on any device, I want weather and daylight for that device’s location, so that the page is relevant wherever I am.

> **US-02** — As the owner starting a browsing session, I want an ordered list of my configured bookmarks, so that I can reach important destinations quickly.

> **US-03** — As a birder, I want nearby lifer, photo, and audio targets plus a month-to-date species comparison, so that I can choose worthwhile outings and understand my current pace.

> **US-04** — As a Claude and Codex user, I want readable short-window and weekly headroom with reset times, so that I can plan coding work around available capacity.

> **US-05** — As the owner using different devices, I want each browser to remember its own display mode and appearance, so that phone and desktop can each use the presentation that suits them.

> **US-06** — As the owner relying on several local and remote data sources, I want partial failures to be honest and contained, so that the rest of the dashboard remains useful.

## Functional Requirements

### Dashboard and Preferences

**FR-01** — The app shall display weather, bookmarks, eBird, and llmdash information in both Dawn and Dense modes.

**FR-02** — The app shall show the same underlying values, freshness, and availability state in both modes; differences between modes shall be presentational only.

**FR-03** — The app shall let the user switch between Dawn and Dense without reloading the page or discarding already loaded widget data.

**FR-04** — The app shall persist the selected display mode in the current browser and restore it on later visits; when no preference exists, it shall default to Dawn.

**FR-05** — The app shall offer System, Light, and Dark appearance settings, persist the selected setting in the current browser, and default to System when no preference exists.

**FR-06** — When System appearance is selected, the app shall follow changes to the device’s light or dark preference while the page is open.

**FR-07** — A missing, unreadable, or cleared local preference shall fall back to the documented defaults without preventing the dashboard from loading.

### Location, Weather, and Daylight

**FR-08** — The app shall attempt to obtain the device’s current location on each page load when browser permission and platform support allow it, and shall provide a user-initiated way to retry location access.

**FR-09** — After a successful location result, the app shall use that location for both weather and nearby eBird data and retain it as the browser’s last-known location with its capture time.

**FR-10** — When a current location is unavailable, the app shall use a last-known location captured within the previous seven days, then the configured home location; it shall not silently use any other location.

**FR-11** — The app shall identify whether location-dependent data uses Current, Last known, or Home location and shall show the age of a Last known location.

**FR-12** — When no current, eligible last-known, or configured home location is available, the weather and nearby eBird areas shall show an unavailable state that explains how to restore location-dependent data.

**FR-13** — The weather area shall show current temperature and conditions, today’s high and low, precipitation likelihood, and the next relevant sunrise and sunset from Open-Meteo.

**FR-14** — Weather dates, forecast periods, sunrise, and sunset shall be interpreted and displayed in the selected location’s local time zone.

**FR-15** — The weather area shall distinguish loading, fresh, stale, permission-denied, and source-error states; data older than 30 minutes or retained after a failed refresh shall be labeled stale, and a failure shall preserve the last successful reading when one exists.

**FR-16** — The weather area shall provide a retry action when location or weather retrieval fails.

### Bookmarks

**FR-17** — The bookmarks area shall load bookmark names and URLs from one host-side configuration and display valid entries in the same order in which they appear there.

**FR-18** — The app shall omit an invalid bookmark entry while identifying the configuration problem; if the entire configuration cannot be read or parsed, it shall preserve the last successfully loaded list when available and label it stale, otherwise show an actionable unavailable state.

**FR-19** — Selecting a bookmark shall navigate to its configured URL, and valid host-side configuration changes shall appear on the next page load without requiring an application rebuild.

### eBird

**FR-20** — The eBird area shall evaluate observations from the previous 14 days within 50 km of the active location by default, with both the observation window and radius configurable by the host.

**FR-21** — The eBird area shall show up to five nearby targets in each of three categories: lifers absent from the user’s eBird life list, photo targets without a photo in the user’s eBird media history, and audio targets without an audio recording in the user’s eBird media history; a species may appear in multiple categories when its eBird record qualifies it.

**FR-22** — Each target shall show common species name, most relevant recent observation date, locality, and distance when supplied by eBird; duplicate observations of one species shall collapse to one target, ranked by shortest distance and then most recent observation.

**FR-23** — The eBird area shall show the distinct species count from the user’s submitted eBird records for the current calendar month through today, the count for the equivalent date range one year earlier, and the signed difference between them.

**FR-24** — The eBird area shall distinguish loading, fresh, stale, empty, credential/configuration error, and source-error states; data older than six hours or retained after a failed refresh shall be labeled stale, and one eBird subsection with no qualifying records shall show an empty state rather than an error.

### llmdash

**FR-25** — The llmdash area shall show, for both Claude and Codex, the remaining 5-hour headroom, remaining weekly headroom, and the reset time for each window whenever llmdash supplies those values.

**FR-26** — The llmdash area shall label each value and provider unambiguously, display reset times in the viewing device’s local time, and show the source data’s last-updated time.

**FR-27** — The app shall treat llmdash values as authoritative, shall not recalculate quota or cost figures, and shall show an unavailable value rather than infer a value that llmdash omits.

**FR-28** — The llmdash area shall distinguish loading, fresh, stale, connection-error, and partial-data states; data older than 15 minutes or retained after a failed refresh shall be labeled stale, and a failure for one provider shall not hide valid data for the other.

### Refresh and Failure Isolation

**FR-29** — The app shall request fresh weather, eBird, and llmdash data on each page load and shall provide a user-initiated refresh that retries all dynamic sources without reloading the page.

**FR-30** — Each widget shall load and fail independently so that an unavailable or slow source does not block preferences, bookmarks, or successful data from other sources.

## Non-Functional Requirements

**NFR-01 — Performance:** On a typical local or tailnet connection, the dashboard shell shall become usable within one second and available cached content within two seconds; slower live sources shall continue loading independently.

**NFR-02 — Accessibility:** Interactive controls and content shall meet WCAG 2.2 AA contrast and keyboard-operability requirements, expose meaningful accessible names and status announcements, and never use color as the only indicator of state.

**NFR-03 — Motion:** The app shall respect the device’s reduced-motion preference, including any Dawn daylight visualization or mode transition.

**NFR-04 — Responsive Layout:** Both modes shall remain readable and operable without horizontal page scrolling at viewport widths from 360 to 1440 CSS pixels.

**NFR-05 — Compatibility:** Core behavior shall work in the current and previous major releases of Safari, Chrome, and Firefox, including mobile Safari; unsupported geolocation shall enter the documented fallback flow.

**NFR-06 — Security:** Service credentials and private upstream addresses shall not be exposed in browser-delivered content, client-visible logs, or URLs, and the deployment shall be intended only for localhost or tailnet access rather than public internet exposure.

**NFR-07 — Privacy:** The app shall include no analytics or third-party tracking and shall not persist or display precise device coordinates beyond what is required to provide location-dependent data.

**NFR-08 — Resilience:** A malformed response, timeout, or unavailable source shall produce the documented state for that source without crashing the page or corrupting the last successful data from another source.

## Out of Scope

- Browser-extension packaging or native new-tab replacement.
- Public hosting, internet exposure, user accounts, multi-user support, or an additional login layer.
- In-page bookmark creation, editing, deletion, or reordering.
- Synchronizing display-mode or appearance preferences between devices.
- Reimplementing or independently deriving llmdash quota calculations.
- A third display mode.
- Alerts, notifications, background push, or scheduled digests.
- Long-term analytics or historical dashboards beyond the specified eBird month comparison.
- Widgets other than weather/daylight, bookmarks, eBird, and llmdash.
- A manually maintained duplicate store for eBird life-list, photo, or audio status.
- Editing eBird observations, lists, or media from homedash.
- Automatic public deployment, DNS setup, or tailnet administration.

## Open Questions

1. **Which authenticated eBird access path can supply the user’s life-list and media-history status?**
   **Default assumption:** The host will receive an eBird credential and user identifier through private configuration, and the build may use a direct eBird interface or an existing local eBird-backed adapter. In either case, eBird remains the authoritative record and homedash shall not maintain parallel target-status data.

2. **What home location should be used as the final fallback?**
   **Default assumption:** No precise home location will be committed to source control. A private deployment setting will supply it before release; until configured, the app will use current or eligible last-known location and otherwise show the documented unavailable state.

3. **Where will llmdash be reachable from the homedash host?**
   **Default assumption:** The host-side connection will target llmdash at `http://127.0.0.1:8787`, with the address privately configurable so the same build can run on the personal machine or Pi.

## Success Metrics

| ID    | What's Being Verified                                     | Pass Condition                                                                                                                                                                                                                                                       |
| ----- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QA-01 | Widget parity across modes (FR-01, FR-02)                 | With one fixed data fixture, Dawn and Dense each show all four widgets with identical values, freshness labels, and availability states.                                                                                                                             |
| QA-02 | Mode switching (FR-03)                                    | Switching Dawn to Dense and back changes the presentation immediately without a page navigation, refetch, or loss of loaded values.                                                                                                                                  |
| QA-03 | Per-device mode persistence (FR-04)                       | A browser with no saved preference opens in Dawn; after selecting Dense and reopening the page, that browser opens in Dense while a second browser remains at its own setting.                                                                                       |
| QA-04 | Appearance behavior and preference fallback (FR-05–FR-07) | System, Light, and Dark each apply and persist independently; System follows an emulated device-theme change, and missing or invalid saved preferences load Dawn with System appearance.                                                                             |
| QA-05 | Current location and caching (FR-08, FR-09)               | Granting location yields weather and eBird requests for the returned location, records its capture time, and the retry action initiates a new location attempt.                                                                                                      |
| QA-06 | Location fallback and provenance (FR-10–FR-12)            | Tests for current, eligible cached, expired cached, home, and no-location conditions select only the documented source, label its provenance and age where applicable, and show recovery guidance when none exists.                                                  |
| QA-07 | Weather and daylight content (FR-13, FR-14)               | A fixed Open-Meteo response renders current conditions, temperature, high, low, precipitation likelihood, sunrise, and sunset using the fixture location’s time zone.                                                                                                |
| QA-08 | Weather state handling (FR-15, FR-16)                     | Loading, denied, error, fresh, and over-30-minute or failed-refresh cached cases show the correct state; retry is available after failure and retained data remains visible as stale.                                                                                |
| QA-09 | Bookmark configuration (FR-17–FR-19)                      | Valid entries render in file order and navigate to their configured URLs; one invalid entry is omitted with a configuration message, a malformed file uses a labeled prior list or unavailable state, and a valid edit appears after page reload without rebuilding. |
| QA-10 | eBird search bounds (FR-20)                               | Default requests use a 14-day window and 50 km radius, and changing either host setting changes the evaluated observation set accordingly.                                                                                                                           |
| QA-11 | eBird target classification and limit (FR-21)             | Controlled life-list and media-history fixtures classify targets into the three documented categories and render no more than five entries in each.                                                                                                                  |
| QA-12 | eBird target details, deduplication, and ordering (FR-22) | Duplicate observations collapse to one species entry; every available field renders, and entries sort by shortest distance then most recent date.                                                                                                                    |
| QA-13 | Monthly eBird comparison (FR-23)                          | Fixtures spanning the current and previous year produce distinct-species counts for matching month-to-date windows and the mathematically correct signed difference.                                                                                                 |
| QA-14 | eBird states (FR-24)                                      | Fresh, over-six-hour, failed-refresh cached, credential-error, source-error, and no-qualifying-target fixtures show distinct correct states without converting an empty result into an error.                                                                        |
| QA-15 | llmdash values and authority (FR-25, FR-27)               | Claude and Codex fixtures render supplied 5-hour and weekly headroom plus reset values exactly as provided; an omitted value is shown unavailable and is not derived.                                                                                                |
| QA-16 | llmdash labels, time, and state handling (FR-26, FR-28)   | Provider/window labels are unambiguous, resets use the device time zone, freshness is visible, over-15-minute or failed-refresh cached data is stale, and one provider’s error leaves the other visible.                                                             |
| QA-17 | Dynamic refresh (FR-29)                                   | Initial load requests all three dynamic sources, and one refresh action retries weather, eBird, and llmdash without a page reload.                                                                                                                                   |
| QA-18 | Independent loading and failures (FR-30, NFR-08)          | Delaying or failing each source in turn leaves controls, bookmarks, and every successful widget usable and prevents uncaught page-level failure.                                                                                                                     |
| QA-19 | Performance (NFR-01)                                      | Under the agreed local/tailnet test profile, the usable shell appears within one second and cached content within two seconds while delayed live requests remain non-blocking.                                                                                       |
| QA-20 | Accessibility and motion (NFR-02, NFR-03)                 | Automated checks report no WCAG AA contrast/name violations, all controls complete a keyboard-only flow with announced state changes, and reduced-motion removes nonessential motion.                                                                                |
| QA-21 | Responsive compatibility (NFR-04, NFR-05)                 | Both modes complete their core flows without horizontal page scrolling at 360, 768, and 1440 CSS pixels in the supported browser matrix, with unsupported geolocation entering fallback.                                                                             |
| QA-22 | Security and privacy (NFR-06, NFR-07)                     | A production build and browser/network inspection expose no service credential or precise coordinate in client content, URLs, or client-visible logs, include no analytics request, and document localhost/tailnet-only deployment.                                  |
