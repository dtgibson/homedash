# Product Context — homedash

## Product

Homedash is a private, single-owner browser start page that brings the most useful morning context into one glanceable view on phone and desktop across the tailnet.

## Current Features

- **Dawn and Dense views** — Two complete presentations render the same live values and source states in one viewport for the normal five-target/five-bookmark payload at 1440×900 and 360×800, fall back to bounded source-region scrolling for shorter or larger cases, and retain per-browser view and appearance preferences.
- **Location-aware weather and daylight** — Current conditions, forecast, sunrise, and sunset use the device location when available, then an eligible last-known location, then a private Home fallback.
- **Birding pulse** — eBird-backed monthly progress and nearby lifer, photo, and audio targets use a ten-mile standard area and a per-browser choice between nearest-first and most-recent-first order.
- **Coding runway** — Claude and Codex five-hour and weekly headroom display the values and reset times supplied by llmdash without reconstructing missing data.
- **Search and launch actions** — A Kagi search stays ready for typing with a contained focus treatment, while constrained My eBird, species-map, and llmdash links turn dashboard context into direct next steps.
- **Immediate saved readings** — Valid per-browser snapshots render on return while weather, bookmarks, eBird, llmdash, and tide refresh independently in place with honest freshness and retry states.
- **Current moon phase** — A deterministic qualitative moon-phase label stays beside daylight context in both views without adding a source, request, or precision claim.
- **Coastal day context** — NOAA current water level, direction, and next turn sit beside sunrise, sunset, and moon context, using the nearest eligible station for the dashboard location unless a private fixed-station override is configured.
- **Shared bookmark settings** — The Settings window keeps presentation choices browser-local while supporting staged, conflict-aware shared bookmark sections with atomic saves, wide unobscured mobile targets, and bounded same-origin favicons with bookmark-specific fallbacks.

## Data and State

The browser owns per-device view, appearance, and eBird-order preferences, last-known location, last-good widget snapshots, and memory-only Settings drafts. The server owns private configuration, the versioned ordered bookmark document, normalized upstream access, validation, and replaceable in-memory caches, including a bounded daily tide-station catalog; there is no database. eBird data arrives through SnowRaven, llmdash remains authoritative for coding headroom, Open-Meteo supplies weather and daylight, and NOAA supplies tide stations, observations, and predictions.

## Stack and Delivery

The application uses TypeScript, React, Vite, Tailwind CSS, Radix UI, Fastify, and Node.js 22+. Production is a systemd user service bound to loopback and exposed to authenticated tailnet devices through Tailscale HTTPS on port 1910. The private bookmark document API accepts only exact configured loopback/Tailscale Hosts and origins, and new writable bookmark state lives in a dedicated mode-`0700` directory.

## Product Boundaries

Homedash has no accounts, analytics, public-internet exposure, or application-level login. Private coordinates, station IDs, upstream addresses, and bookmarks remain host-side; tide responses expose only a validated station name and normalized reading. Dynamic widgets load and fail independently so one unavailable source never takes down the page.

## Deferred

- Learn from daily use before adding more widgets, alerts, or historical dashboards.
- Add application-level rate limiting before supporting multiple users, public access, or substantially more expensive refresh work.
