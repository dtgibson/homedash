# Project Conventions

## Data Boundaries

- Keep private upstream URLs, exact coordinates, and real bookmarks on the server; browser code calls same-origin normalized endpoints only.
- Give every dynamic widget an independent endpoint, runtime contract, freshness policy, loading and error state, retry path, and last-good snapshot.
- Hydrate each valid browser-owned last-good snapshot before live work settles, keep its values visible while that source refreshes, and replace it only with that source's next validated response.
- Feed Dawn and Dense from the same normalized dashboard state; a renderer may change layout but never values, freshness, availability, or ordering.
- Treat upstream systems as authoritative: eBird through SnowRaven for birding history and media, llmdash for coding headroom, NOAA for tide data, and the host bookmark file for link order.
- Bound third-party bodies and record counts, validate every provider field before caching, reject control characters in strings that reach product copy, and enforce request deadlines through body streaming after headers.

## Browser State

- Keep display mode, appearance, and eBird target order together in the versioned per-browser preference record `homedash.preferences.v1`; do not sync these settings between devices.
- Keep exact device coordinates out of responses, URLs, and logs; weather, eBird, and automatic tide selection share the fallback from current to an eligible seven-day last-known value to the private Home setting.

## Domain Rules

- For each eBird target category, derive deterministic nearest-first and most-recent-first projections from one normalized pool, deduplicate by canonical species under that projection's comparator, and apply the result limit only after ordering; switching the browser-owned order must not trigger another request.
- Keep the private host bookmark document authoritative. Editor drafts are memory-only; publish ordered sections and bookmarks only after a complete, revision-checked, atomically verified save.
- Treat bookmark favicons as bounded cosmetic enhancement: resolve only the current configured bookmark's conventional icon through the same-origin service and keep names, order, navigation, and freshness independent of icon success.
- With a blank tide station setting, choose the nearest eligible active NOAA tidal water-level station on the server; a valid private fixed station overrides that choice, NOAA receives no selection coordinates, and browser responses expose the station name but never its ID or coordinates.

## Viewport Layout

- Keep Dawn and Dense free of document scrolling for the normal five-target/five-bookmark payload at 1440×900 and 360×800; on shorter viewports or larger payloads, bound overflow to the affected source region.
- Keep masthead content inside its assigned pane; viewport tests must inspect both the document and nested scroll regions and reserve clearance for visible keyboard-focus outlines.

## Deployment

- Keep Fastify bound to loopback in production and let Tailscale provide authenticated HTTPS; do not expose the Node listener directly to the LAN or public internet.
- The public bootstrap is the supported install, update, and uninstall entry point; it must preserve private configuration on updates, avoid changing system Node.js or unrelated services, and keep removal scoped to homedash.
- Codex prepares and verifies deployment scripts locally but never accesses or changes production machines; the user alone runs production updates and reports the result.
- Add application-level rate limiting before the service becomes multi-user, publicly reachable, or materially more expensive per refresh.
