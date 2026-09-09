# Change Brief — Instant Cached Data Refresh

## What is changing
Hydrate weather, bookmarks, eBird, and llmdash from their existing validated per-browser last-good snapshots before live requests settle. Show cached values as stale/refreshing, keep them visible during automatic and manual refreshes, and replace each source in place only when its own valid response arrives. This strengthens the existing loading, freshness, and failure behavior; it adds no screen, source, flow, schema, or data model, so it belongs in Improve.

## Why now
`useDashboardData` currently starts every source as empty loading state, clears ready data at each request, and consults `homedash.cache.*.v1` only after a failure. Slow eBird matching and location resolution therefore leave a returning browser blank even when a valid last-good snapshot already exists, contrary to the one-glance and cached-content goals.

## User-facing impact
Returning browsers see their last-good dashboard values immediately while each source refreshes independently in the background. Dawn and Dense retain the same values, ordering, links, controls, and source boundaries; a subtle accessible last-updated/refreshing treatment makes cached age honest, then disappears or updates without layout jumps when fresh data arrives. First visits with no valid snapshot keep the established loading and error states.

## Design pass
Needed — refine the existing weather, birding, coding-runway, and bookmark state treatments in both Dawn and Dense, plus the toolbar refresh feedback. Cached age and background activity should feel quiet but unmistakable, use text rather than color alone, preserve keyboard/screen-reader announcements, and stay within the approved 1440×900 and 360×800 one-glance budgets.

## Decisions touched
- **homedash v1: device-owned presentation** — reuse browser-owned snapshots while Dawn and Dense continue to render one normalized state.
- **homedash v1: authoritative sources and isolated failures** — cached envelopes remain temporary source copies; independent refreshes never invent values, reorder targets/bookmarks, or blank another source.
- **Single-screen dashboard: bounded one-glance layouts** — freshness indicators and in-place updates must not introduce document scrolling or source-region overflow for the normal payload.

## Scope
Likely implementation surfaces are `src/hooks/useDashboardData.ts`, `src/lib/storage.ts`, `src/components/WidgetState.tsx`, the existing Dawn/Dense source markup and styles, and focused unit/browser tests. Preserve the current snapshot keys and validated envelope contracts. Server routes, upstream adapters, in-memory server cache policy, source normalization, launch/search behavior from the prior Spool build, configuration, and infrastructure are out of scope.

## Data and privacy boundaries
Read and write only the existing same-browser `homedash.cache.{weather,bookmarks,ebird,llmdash}.v1` envelopes after schema validation. Do not add credentials, private upstream addresses, analytics, network prefetches, or new persisted fields; exact coordinates remain confined to the existing separate location record and requests. Location-dependent cached values retain their recorded provenance and stale status until the selected location refresh replaces them.

## What done looks like
- A valid snapshot renders on initial paint while its live request remains unresolved; valid fresh data replaces it in place without an intervening loading blank.
- Failed refresh preserves cached values with accurate last-updated/stale and retry feedback; missing, malformed, or version-incompatible snapshots follow existing loading/error behavior.
- Tests cover all four sources, independent completion/failure, location provenance, manual refresh, Dawn/Dense parity, accessibility, and both viewport budgets.

## Deployment
No deployment. Do not change installer, systemd/Tailscale setup, host configuration, secrets, ports, or production infrastructure; this Spool build stops at its normal bundle boundary.
