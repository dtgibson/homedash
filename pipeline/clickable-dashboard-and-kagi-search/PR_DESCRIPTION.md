## Clickable Dashboard and Kagi Search

### What this does

Turns homedash into a keyboard-first launch surface while preserving the shared Dawn/Dense data model and one-screen composition.

- Adds one compact shared Kagi GET form, focuses it once on initial mount, trims submitted text, and blocks blank searches without persisting or pre-sending the query.
- Links the month comparison to My eBird, each validated species target to its eBird map, and the always-visible llmdash source identity to a fixed same-origin launch route.
- Adds constrained server redirects with strict species-code validation, no-store responses, safe non-redirecting failures, and an isolated private `LLMDASH_LAUNCH_URL` setting.
- Converts eBird kilometers to miles only at the presentation boundary. Existing `radiusKm`, `distanceKm`, target eligibility, sorting, and API contracts are unchanged.
- Extends the responsive toolbar and source layouts so the normal five-target/five-bookmark fixture still fits at 1440×900 and 360×800.

### Security and privacy

- The client contains only `/launch/ebird/my-ebird`, `/launch/ebird/map/:speciesCode`, and `/launch/llmdash`; it never receives the configured llmdash destination.
- Launch actions reject query injection, malformed/encoded path input, unsupported methods, credentials, fragments, and non-HTTP(S) llmdash destinations without reflecting rejected values.
- The llmdash launch destination is independent from `LLMDASH_URL`, does not affect source health, and is resolved only after explicit navigation.
- CSP changes only `form-action`, from `'none'` to the exact `https://kagi.com/search` action. Script, connection, frame, object/default, and all other restrictions are unchanged.
- The public installer now uses a loopback llmdash source default and preserves an existing private `.env` byte-for-byte on updates.

### How to test

1. Run `npm run check`.
2. Run `npm run test:e2e` for the 1440×900 and 360×800 Chromium projects.
3. Confirm the Kagi field owns initial focus, retains its unsubmitted value across Dawn/Dense and appearance changes, trims a submitted query, and announces rather than navigates on blank input.
4. In both renderers, inspect the native My eBird, target-map, and llmdash links and confirm eBird radius/target copy uses miles with no display-side kilometer text.
5. Exercise `/launch/ebird/map/:speciesCode` with valid and malformed identifiers and `/launch/llmdash` with ready, missing, and invalid settings; rejected requests must never include `Location`.
6. Confirm loading or failure of llmdash data does not remove its source link or affect the fixed launch route.

### Deployment note

Set `LLMDASH_LAUNCH_URL` in the private host `.env` to the absolute HTTP(S) browser destination, then restart homedash. Existing installations are not modified automatically; a missing value leaves every dashboard source working and makes only `/launch/llmdash` return a safe 503.

### Verification completed

- `npm test` — 41 tests passed.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `npm run test:e2e` — desktop/mobile viewport suite passed (one intentional desktop-only skip for the mobile retry-target check).
- `weft-design-lint check src` — clean, 21 files scanned, 0 findings.
