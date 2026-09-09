## Moon Phase Near Sunrise and Sunset

### What this does

Adds a deterministic, qualitative current moon-phase label to the existing Dawn and Dense daylight contexts. One browser-owned lifecycle hook derives the shared eight-phase label from the device clock, updates at phase-band or local-date boundaries and after existing refreshes settle, and stays independent of weather availability without adding a source, request, cache, control, or server contract.

### How to test

1. Run `npm test` to verify the known lunar dates, exact band boundaries, invalid inputs, lifecycle scheduling, visibility wake-up, cleanup, renderer parity, and refresh-settlement integration.
2. Run `npm run test:e2e` to exercise Dawn and Dense at 1440×900 and 360×800, including appearances, weather loading/error independence, invalid-time omission, request counts, and overflow.
3. Start the app with `npm run dev`, then open `http://localhost:5173`.
4. Confirm Dawn shows `Moon · <phase>` below sunrise, daylight, and sunset in the existing masthead treatment.
5. Switch to Dense and confirm the same canonical phase appears after the solar summary in the existing Weather row.
6. Refresh the dashboard and switch System, Light, and Dark appearances; the phase should remain current, quiet, and unchanged by weather freshness.

### Notes for reviewer

- The calculation uses the approved fixed new-moon epoch (`2000-01-06T18:14:00Z`), mean synodic period, and lower-inclusive eight-band mapping. It is intentionally qualitative rather than ephemeris-grade.
- `MoonPhaseLabel | null` is the only value passed to renderers. Invalid derivation removes all lunar output and does not retain a previous or fallback label.
- Scheduling owns one timeout at a time and one visibility listener. There is no interval, high-frequency polling, animation, network source, persistence, or new public configuration.
- Server files, API contracts, browser storage keys, source counts, attribution, location behavior, and CSP are unchanged.
- This repository's Playwright projects exercise desktop and mobile Chromium. Safari/WebKit and Firefox compatibility follows standard `Date`, timer, visibility, and React APIs but remains a manual or downstream cross-browser QA item in this environment.
