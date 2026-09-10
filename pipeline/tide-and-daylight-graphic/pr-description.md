## Tide and Daylight Graphic

### What this does

Adds one independently refreshed NOAA tide source that automatically selects the nearest eligible station from Homedash's existing location choice, with a private fixed-station override, and combines it with daylight and moon context. Dawn presents a shared coastal-day graphic with the current height, observed or predicted basis, direction, next turn, station, and datum; Dense carries the same facts in a compact row with an inline trace.

The browser keeps a validated last-good tide snapshot and refreshes tide as a fifth source without blocking weather, bookmarks, eBird, or llmdash. Missing observations fall back honestly to predictions, upstream failures retain eligible stale data, and tide-only retry leaves every other source untouched.

### How to test

1. Copy `.env.example` to `.env` if needed and leave `TIDE_STATION_ID` blank for automatic nearest-station selection. Set a valid NOAA station ID and optional label only to test the fixed override.
2. Run `npm install`, then start Homedash with `npm run dev`.
3. Open `http://127.0.0.1:5173` and confirm Dawn shows the tide curve under the sun arc, the current height and basis, direction, next high or low, station label, datum, moon phase, and tide freshness.
4. Switch to Dense and confirm the same facts appear with a compact tide trace.
5. Check Dawn and Dense at 1440×900 and 360×800 in System, Light, and Dark. Confirm the document stays within the viewport, labels remain legible, and bookmark targets remain contained.
6. Set an invalid fixed station override in a local test environment and confirm daylight, moon, weather, and the other dashboard sources remain usable while tide shows its own unavailable state and retry.
7. Run `npm run check`, `npm run test:e2e`, and `~/.weft/bin/weft-design-lint check src/`.

### Notes for reviewer

- `POST /api/tide` accepts only the shared validated location selector and browser time zone, never a browser-selected station. The server compares that location against a bounded cached generic NOAA catalog without sending coordinates to NOAA, then uses fixed server-owned product requests.
- Water-level observations, interval predictions, and high/low predictions have independent caches. An observation must be no more than 60 minutes old; otherwise the normalized current value is interpolated and labeled `predicted`, with partial freshness.
- A stale last-good envelope may survive a failed refresh within the approved age bound, but malformed, oversized, non-finite, duplicate, or chronologically invalid provider data never replaces it.
- `TIDE_STATION_ID` and `TIDE_STATION_LABEL` remain private optional override values. The installer preserves existing `.env` values; a missing or blank ID enables automatic selection.
- The implementation adds no database, credentials, browser-to-NOAA request, new component library, or new color token. SVG graphics are supplementary; adjacent text carries the complete accessible meaning.
