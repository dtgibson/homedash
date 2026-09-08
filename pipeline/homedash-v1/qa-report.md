# QA Report — homedash v1

**Date:** 2026-09-07
**Test Runner:** Vitest, React Testing Library, Playwright, axe-core
**Result:** PASSED

## Test Suite Results

- Formatting, ESLint, both TypeScript builds, and the production build passed.
- 14 Vitest unit and integration tests passed; 0 failed.
- The standard Playwright scenario passed in desktop and mobile Chromium; 2 passed, 0 failed.
- The same Dawn/Dense flow passed at 1440 px in Chromium, 768 px in Firefox, and 360 px in WebKit; 3 passed, 0 failed.
- axe-core 4.13 found 0 automated accessibility violations.
- Weft design lint scanned 19 files and found 0 issues.

## Acceptance Criteria Verification

| Criterion | Result | Notes |
| --- | --- | --- |
| QA-01 Widget parity across modes | ✓ Pass | The shared dashboard state feeds both Dawn and Dense; unit and browser checks found the same four widgets and values in both views. |
| QA-02 Mode switching | ✓ Pass | Dawn and Dense switch in place while loaded fixture values remain visible. |
| QA-03 Per-device mode persistence | ✓ Pass | Browser storage restores Dense after reload and retains defaults independently for a fresh browser context. |
| QA-04 Appearance and fallback | ✓ Pass | System, Light, and Dark persist independently; live media emulation confirmed System follows a device-theme change, and malformed storage falls back to Dawn/System. |
| QA-05 Current location and caching | ✓ Pass | Geolocation drives weather and eBird together, stores a timestamped last-known location, and the Location control requests it again. The owner confirmed the current-device path over tailnet HTTPS. |
| QA-06 Location fallback and provenance | ✓ Pass | Current, eligible seven-day last-known, configured Home, and unavailable paths are explicitly selected and labeled; expired cached coordinates are rejected. |
| QA-07 Weather and daylight content | ✓ Pass | Open-Meteo normalization and the live endpoint provide current conditions, high, low, precipitation, sunrise, sunset, and local-time-zone data. |
| QA-08 Weather states | ✓ Pass | Independent loading, error, retry, fresh, stale, and last-good behavior is implemented through the weather envelope and widget state components. |
| QA-09 Bookmark configuration | ✓ Pass | Integration tests omit invalid entries safely and preserve valid file order; the live host file loaded all five bookmarks without a rebuild. |
| QA-10 eBird search bounds | ✓ Pass | SnowRaven requests use the configured 14-day and 50 km defaults and read both values from host configuration. |
| QA-11 eBird classification and limit | ✓ Pass | Authoritative life-list and media-history sets classify lifer, photo, and audio independently; each live list returned the configured maximum of five. |
| QA-12 eBird details and ordering | ✓ Pass | Unit tests verify canonical deduplication, distance-first ordering, recency tie-breaking, and unknown-distance placement. Live lifer, photo, and audio distances were all ascending. |
| QA-13 Monthly eBird comparison | ✓ Pass | Distinct-species fixtures pass across matching month-to-date windows; the live SnowRaven result returned the current and prior-year counts plus signed difference. |
| QA-14 eBird states | ✓ Pass | Fresh, stale, missing-media, empty, configuration, source-error, and last-good states are isolated and represented explicitly. |
| QA-15 llmdash authority | ✓ Pass | Integration tests copy supplied percentages exactly and leave missing windows null; the live service returned both providers without derived values. |
| QA-16 llmdash labels and state | ✓ Pass | Provider and window labels, device-local reset formatting, freshness, partial data, and independent provider availability are implemented and visible. |
| QA-17 Dynamic refresh | ✓ Pass | Initial load requests weather, eBird, and llmdash; Refresh retries all dynamic sources without page navigation. |
| QA-18 Failure isolation | ✓ Pass | Each widget has its own request and state. Promise isolation and per-source last-good caches prevent one source from hiding another. |
| QA-19 Performance | ✓ Pass | Tailnet HTTPS returned the shell in 40 ms and the uncached live weather request in 806 ms; independent requests do not block the usable shell. |
| QA-20 Accessibility and motion | ✓ Pass | axe-core found 0 violations. Keyboard checks covered the Radix radio groups and toolbar controls, status regions announce updates, and reduced-motion media emulation applied the 0.01 ms override. |
| QA-21 Responsive compatibility | ✓ Pass | The core flow passed without horizontal overflow at 360 px WebKit, 768 px Firefox, and 1440 px Chromium, in addition to the standard desktop/mobile Chromium projects. |
| QA-22 Security and privacy | ✓ Pass | The browser build contains no private upstream address or test coordinate, no analytics integration exists, strict same-origin/security headers are live, and the app is exposed only through tailnet HTTPS. |

## Edge Cases Tested

- Missing and malformed browser preferences.
- Eligible and expired last-known device locations.
- Malformed coordinates rejected before any upstream request.
- Invalid bookmark entries omitted without exposing unsafe values.
- Missing llmdash windows preserved as unavailable rather than inferred.
- Duplicate eBird observations, tied distances, and unknown distances.
- eBird species classification across overlapping target categories.
- Leap-safe equivalent partial-month comparison.
- System-theme changes while the page is open.
- Reduced-motion behavior and keyboard-only toolbar operation.
- Dense view at 360 px without horizontal page scrolling.

## Known Limitations

- The live eBird profile currently reports stale freshness because the personal export in SnowRaven is older than six hours. Homedash labels that state correctly; refreshing the export in SnowRaven makes it fresh.
- llmdash currently omits Codex's five-hour window and reports aging data for some windows. Homedash shows those values as partial/unavailable and does not derive replacements.
- Previous major browser releases were not separately pinned in automation; current Chromium, Firefox, and WebKit engines all passed, and the implementation uses no engine-specific APIs outside the documented geolocation fallback.
- The private Home fallback is intentionally unconfigured on this host. Current-device and seven-day last-known location work; adding private coordinates enables the final fallback.

## Verification Note

The first keyboard harness assertion ran before Radix completed its asynchronous focus handoff. Re-running after waiting for focus and location-control readiness passed without an application change.
