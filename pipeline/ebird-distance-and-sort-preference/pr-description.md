## eBird Distance and Sort Preference

### What this does

Narrows the standard nearby eBird area to 16 kilometers, shown as 10 miles, and adds one browser-local choice between Nearest and Recent. The server derives both deterministic, deduplicated five-target projections from one complete SnowRaven nearby pool, while Dawn and Dense switch between them immediately without another request.

The existing `targets` response remains the nearest-first compatibility projection. Updates migrate only one exact installer-managed `EBIRD_RADIUS_KM=50` line; custom, commented, spaced, duplicated, and missing values remain untouched.

### How to test

1. Run `npm run check`.
2. Run `npm run test:e2e`.
3. Open Homedash and find Birding pulse in Dawn.
4. Confirm the context says `within 10 mi`, Nearest is selected, and target rows show distance and observation age.
5. Select Recent and confirm the list changes immediately while focus, category, and source freshness stay put.
6. Switch category, Dawn/Dense, and appearance; confirm the selected order persists.
7. Reload and confirm the browser restores the selected order.
8. Exercise `scripts/migrate-managed-env.mjs` through the installer-policy tests and confirm only the exact previous managed default changes.

### Notes for reviewer

The browser never sends the order preference to the server, and the eBird cache key remains location/time-zone owned. Exact comparator ties finish with code-point lexical fields, preventing provider row order from changing output. No database, extra SnowRaven call, radius control, or production access is introduced.

## Convention Flags

- Keep additive, bounded server projections together when a browser-local presentation preference must switch saved-first data without a request.
- Treat managed environment migrations as exact, single-key byte-preserving changes; ambiguous or customized host state remains authoritative.
