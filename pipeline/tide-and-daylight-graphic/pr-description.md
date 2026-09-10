## Tide and Daylight Graphic

### What this does

Adds one independently refreshed NOAA tide source for the privately configured local station and combines it with Homedash's existing daylight and moon context. Dawn now presents a shared coastal-day graphic with the current height, observed or predicted basis, direction, next turn, station, and datum; Dense carries the same facts in a compact row with an inline trace.

The browser keeps a validated last-good tide snapshot and refreshes tide as a fifth source without blocking weather, bookmarks, eBird, or llmdash. Missing observations fall back honestly to predictions, upstream failures retain eligible stale data, and tide-only retry leaves every other source untouched.

### How to test

1. Copy `.env.example` to `.env` if needed, set `TIDE_STATION_ID` to an eligible NOAA Tides & Currents station, and optionally set `TIDE_STATION_LABEL`.
2. Run `npm install`, then start Homedash with `npm run dev`.
3. Open `http://127.0.0.1:5173` and confirm Dawn shows the tide curve under the sun arc, the current height and basis, direction, next high or low, station label, datum, moon phase, and tide freshness.
4. Switch to Dense and confirm the same facts appear with a compact tide trace.
5. Check Dawn and Dense at 1440×900 and 360×800 in System, Light, and Dark. Confirm the document stays within the viewport, labels remain legible, and bookmark targets remain contained.
6. Remove or invalidate the tide station in a local test environment and confirm daylight, moon, weather, and the other dashboard sources remain usable while tide shows its own unavailable state and retry.
7. Run `npm run check`, `npm run test:e2e`, and `~/.weft/bin/weft-design-lint check src/`.

### Notes for reviewer

- `POST /api/tide` accepts no request body or browser-selected station. NOAA is the fixed server-owned upstream, and provider responses are size-bounded and schema-validated before use.
- Water-level observations, interval predictions, and high/low predictions have independent caches. An observation must be no more than 60 minutes old; otherwise the normalized current value is interpolated and labeled `predicted`, with partial freshness.
- A stale last-good envelope may survive a failed refresh within the approved age bound, but malformed, oversized, non-finite, duplicate, or chronologically invalid provider data never replaces it.
- `TIDE_STATION_ID` and `TIDE_STATION_LABEL` are private environment values. The installer adds empty/default placeholders only when absent and preserves existing `.env` values.
- The implementation adds no database, credentials, browser-to-NOAA request, new component library, or new color token. SVG graphics are supplementary; adjacent text carries the complete accessible meaning.

