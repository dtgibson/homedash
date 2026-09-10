# Strategic Brief — Tide and Daylight Graphic

## What We're Building
Add the current local tide and its next turn to Homedash's existing sunrise, sunset, and moon context. Homedash automatically chooses the nearest eligible NOAA station from the same location already used for weather, while retaining a private fixed-station override. Dawn presents the day as one compact visual story; Dense carries the same tide facts and a restrained inline trace without adding another dashboard destination.

## Why Now
Homedash already answers when daylight begins and ends, but a coastal morning also changes with the water. The first production check showed that requiring a separately configured station leaves the new source unavailable even though Homedash already has a usable location. Automatic selection removes that redundant setup while keeping tide beside the existing solar and lunar context.

## The User Problem
The owner currently leaves the start page to learn whether the water is high, low, rising, or falling and when it will turn. A standalone tide card would add another place to scan; the useful outcome is a single, glanceable day story with the source and freshness stated honestly.

## Success Criteria
- The latest available tide height, rising/falling state, and next high or low appear beside the existing daylight and moon context.
- Dawn combines tide and daylight in a readable graphical treatment with text carrying every essential value.
- Dense shows the same tide meaning and freshness in its compact scanning language.
- Tide loads and fails independently; weather, sunrise/sunset, and moon remain useful when the tide source is slow or unavailable.
- The nearest eligible station is selected automatically from the current, recent last-known, or Home location already chosen for weather.
- A valid private fixed-station setting overrides automatic selection for locations where geometric proximity is not the best tide reference.
- Coordinates and station IDs remain outside tide responses and logs, and the browser never calls the tide provider directly.

## Scope
- A server-owned tide source that selects the nearest eligible NOAA station locally from a bounded, cached station catalog, including current water level, recent direction, next high/low, source time, and the day's prediction points.
- Reuse of Homedash's current → recent last-known → Home location chain for weather, eBird, and automatic tide selection.
- The existing private station ID and label as an optional explicit override, not required setup.
- A normalized tide contract, independent endpoint, bounded cache, last-good browser snapshot, refresh/retry state, and source-specific tests.
- One combined graphical day-and-tide treatment in Dawn and a compact text-plus-trace treatment in Dense.
- Refresh progress and accessibility language updated to include the fifth dynamic source.
- Private configuration and public example/docs updated to explain automatic selection and the optional override without committing personal values.

## Out of Scope
- Station search, maps, or manual station selection in the browser.
- Tide alerts, historical charts, marine weather, currents, waves, or route planning.
- Replacing the weather provider's sunrise/sunset data or the local moon-phase calculation.
- Persisting tide history or adding a database.
- Production access by Codex; release remains a locally verified, user-run update.

## Key Decisions
- Treat tide as its own independently refreshed source even though it is presented beside daylight.
- Select the nearest eligible active tidal water-level station on the server from NOAA's generic station catalog; NOAA never receives the device or Home coordinates used for the comparison.
- Keep `TIDE_STATION_ID` and `TIDE_STATION_LABEL` as an optional fixed override because nearest-by-distance is not always the best hydrological reference.
- Share the existing weather location selector and fallback order instead of creating separate tide location state.
- Show observed current water level when available and clearly distinguish it from predictions; do not imply precision the source did not provide.
- Keep text authoritative and graphics supplementary for accessibility and failure resilience.
- Preserve Dawn/Dense parity, browser-owned last-good behavior, and the existing single-screen viewport budgets.
