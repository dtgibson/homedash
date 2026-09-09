# Product Context — homedash

## Product

Homedash is a private, single-owner browser start page that brings the most useful morning context into one glanceable view on phone and desktop across the tailnet.

## Current Features

- **Dawn and Dense views** — Two complete presentations render the same live values and source states in one viewport for the normal five-target/five-bookmark payload at 1440×900 and 360×800, fall back to bounded source-region scrolling for shorter or larger cases, and retain per-browser view and appearance preferences.
- **Location-aware weather and daylight** — Current conditions, forecast, sunrise, and sunset use the device location when available, then an eligible last-known location, then a private Home fallback.
- **Birding pulse** — eBird-backed monthly progress and nearby lifer, photo, and audio targets are deduplicated and ordered closest-first.
- **Coding runway** — Claude and Codex five-hour and weekly headroom display the values and reset times supplied by llmdash without reconstructing missing data.
- **Host-managed bookmarks** — Valid bookmarks load from one private host configuration and appear in file order after reload.

## Data and State

The browser owns per-device preferences, last-known location, and last-good widget snapshots. The server owns private configuration, normalized upstream access, validation, and replaceable in-memory caches; there is no database. eBird data arrives through SnowRaven, llmdash remains authoritative for coding headroom, and Open-Meteo supplies weather and daylight.

## Stack and Delivery

The application uses TypeScript, React, Vite, Tailwind CSS, Radix UI, Fastify, and Node.js 22+. Production is a systemd user service bound to loopback and exposed to authenticated tailnet devices through Tailscale HTTPS on port 1910.

## Product Boundaries

Homedash has no accounts, analytics, public-internet exposure, or application-level login. Private coordinates, upstream addresses, and bookmarks remain host-side. Dynamic widgets load and fail independently so one unavailable source never takes down the page.

## Deferred

- Learn from daily use before adding more widgets, alerts, or historical dashboards.
- Revisit in-page bookmark management only if editing the host configuration proves too cumbersome.
- Add application-level rate limiting before supporting multiple users, public access, or substantially more expensive refresh work.
