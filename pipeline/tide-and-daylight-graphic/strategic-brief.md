# Strategic Brief — Tide and Daylight Graphic

## What We're Building
Add the current local tide and its next turn to Homedash's existing sunrise, sunset, and moon context. Dawn presents the day as one compact visual story; Dense carries the same tide facts and a restrained inline trace without adding another dashboard destination.

## Why Now
Homedash already answers when daylight begins and ends, but a coastal morning also changes with the water. Tide belongs beside the existing solar and lunar context because all three help the owner read the shape of the day before deciding when to head out.

## The User Problem
The owner currently leaves the start page to learn whether the water is high, low, rising, or falling and when it will turn. A standalone tide card would add another place to scan; the useful outcome is a single, glanceable day story with the source and freshness stated honestly.

## Success Criteria
- The latest available tide height, rising/falling state, and next high or low appear beside the existing daylight and moon context.
- Dawn combines tide and daylight in a readable graphical treatment with text carrying every essential value.
- Dense shows the same tide meaning and freshness in its compact scanning language.
- Tide loads and fails independently; weather, sunrise/sunset, and moon remain useful when the tide source is slow or unavailable.
- Private coordinates and station configuration remain server-side, and the browser never calls the tide provider directly.

## Scope
- A server-owned tide source for one configured local station, including current water level, recent direction, next high/low, source time, and the day's prediction points.
- A normalized tide contract, independent endpoint, bounded cache, last-good browser snapshot, refresh/retry state, and source-specific tests.
- One combined graphical day-and-tide treatment in Dawn and a compact text-plus-trace treatment in Dense.
- Refresh progress and accessibility language updated to include the fifth dynamic source.
- Private configuration and public example/docs updated for the selected station without committing personal values.

## Out of Scope
- Station search or selection in the browser.
- Tide alerts, historical charts, marine weather, currents, waves, or route planning.
- Replacing the weather provider's sunrise/sunset data or the local moon-phase calculation.
- Persisting tide history or adding a database.
- Production access by Codex; release remains a locally verified, user-run update.

## Key Decisions
- Treat tide as its own independently refreshed source even though it is presented beside daylight.
- Use a configured fixed station rather than sending device or home coordinates to the tide provider.
- Show observed current water level when available and clearly distinguish it from predictions; do not imply precision the source did not provide.
- Keep text authoritative and graphics supplementary for accessibility and failure resilience.
- Preserve Dawn/Dense parity, browser-owned last-good behavior, and the existing single-screen viewport budgets.
