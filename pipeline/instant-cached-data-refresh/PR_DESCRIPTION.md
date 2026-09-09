## Instant Cached Data Refresh

### What this does

Makes homedash useful on the first returning paint by hydrating weather, bookmarks, eBird, and llmdash from their existing validated browser snapshots before live requests settle. Each source now refreshes independently without blanking its last-good values, reports a consistent updated/refreshing/failed state in Dawn and Dense, and offers a source-specific retry when a refresh fails.

The shared toolbar reports determinate batch progress while source regions remain readable and interactive. First visits or invalid snapshots retain the established source-local loading and empty-error treatments.

### How to test

1. Run `npm run check`.
2. Run `npm run test:e2e` to exercise the 1440×900 desktop and 360×800 mobile projects.
3. Load homedash once so all four sources write valid snapshots, then reload. Confirm all saved readings appear immediately with `Refreshing` source lines and no loading blank.
4. Confirm sources settle one by one, each valid response replaces only its own values, and the toolbar advances from `Refreshing 0/4` to `Refresh`.
5. Trigger a refresh failure with an existing snapshot. Confirm the last-good values and location provenance remain visible, the source line says `Refresh failed`, and its named `Try again` control is keyboard reachable.
6. Use the global Refresh action and switch between Dawn/Dense or appearance modes while it runs. Confirm in-flight state, saved values, and the selected eBird category are preserved.
7. Verify malformed, missing, and version-incompatible snapshots use the existing first-visit loading/error path.
8. At both approved viewports, confirm the normal five-target/five-bookmark payload has no document or source-region overflow.

### Notes for reviewer

- Snapshot keys, Zod envelope schemas, server routes, upstream adapters, server caching, launch/search behavior, and deployment files are unchanged.
- Hydrated snapshots are marked stale only in memory; a valid live envelope is persisted without additional fields. A failed request preserves the current in-memory last-good envelope and adds retry context without overwriting the stored snapshot.
- `SourceFreshness` owns timestamp formatting, state vocabulary, polite atomic status semantics, and named source retry behavior for both renderers. Provider/subsection health remains separate.
- Relative age is intentionally calculated on render rather than announced by a minute ticker, avoiding repetitive screen-reader updates and layout churn.
- Mobile density adjustments keep the new fixed-height freshness lines, 44px normal-payload targets, and both one-screen compositions within the existing viewport contract.

### Verification completed

- `npm test` — 46 tests passed.
- `npm run test:e2e` — 7 tests passed across desktop/mobile; one intentional desktop skip for a mobile-only retry-target assertion.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `weft-design-lint check src/` — clean, 22 files scanned, 0 findings.
