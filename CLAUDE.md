# Project Conventions

## Data Boundaries

- Keep private upstream URLs, exact coordinates, and real bookmarks on the server; browser code calls same-origin normalized endpoints only.
- Give every dynamic widget an independent endpoint, runtime contract, freshness policy, loading and error state, retry path, and last-good snapshot.
- Feed Dawn and Dense from the same normalized dashboard state; a renderer may change layout but never values, freshness, availability, or ordering.
- Treat upstream systems as authoritative: eBird through SnowRaven for birding history and media, llmdash for coding headroom, and the host bookmark file for link order.

## Browser State

- Keep display mode and appearance together in the versioned per-browser preference record `homedash.preferences.v1`; do not sync these settings between devices.
- Keep exact device coordinates out of responses, URLs, and logs; location falls back only from current to an eligible seven-day last-known value to the private Home setting.

## Domain Rules

- For each eBird target category, deduplicate by canonical species, sort known numeric distances ascending, use recency only to break equal-distance ties, place unknown distances last, and apply the result limit after sorting.
- Preserve bookmark file order in the UI; do not introduce a client-side editor or competing bookmark store without an explicit product decision.

## Viewport Layout

- Keep Dawn and Dense free of document scrolling for the normal five-target/five-bookmark payload at 1440×900 and 360×800; on shorter viewports or larger payloads, bound overflow to the affected source region.
- Keep masthead content inside its assigned pane; viewport tests must inspect both the document and nested scroll regions and reserve clearance for visible keyboard-focus outlines.

## Deployment

- Keep Fastify bound to loopback in production and let Tailscale provide authenticated HTTPS; do not expose the Node listener directly to the LAN or public internet.
- The public bootstrap is the supported install, update, and uninstall entry point; it must preserve private configuration on updates, avoid changing system Node.js or unrelated services, and keep removal scoped to homedash.
- Add application-level rate limiting before the service becomes multi-user, publicly reachable, or materially more expensive per refresh.
