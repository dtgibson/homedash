# Decisions — homedash v1

## 2026-09-07 — Default server port

- **Decision:** Homedash defaults to port `1910` for local and Raspberry Pi deployments.
- **Reason:** Explicit user preference.
- **Status:** Approved.

## 2026-09-07 — Closest-first eBird targets

- **Decision:** Lifers, photo targets, and audio targets are ordered by shortest available distance first; recency breaks equal-distance ties, and targets without a distance appear after targets with a known distance.
- **Reason:** The dashboard should surface the most immediately actionable nearby opportunities first in every target category.
- **Status:** Approved.

## 2026-09-08 — Idempotent Raspberry Pi lifecycle

- **Decision:** Publish a one-line HTTPS bootstrap from the secret-free public repository for first installation and future updates. It preserves private configuration, provisions an isolated Node.js 22 runtime when required, verifies and builds the app, runs homedash as a restart-on-failure systemd user service on loopback port `1910`, and adds a dedicated tailnet-only Tailscale HTTPS listener without replacing existing Serve routes. Its `--uninstall` path removes only homedash and its managed runtime while backing up private settings and leaving system Node.js, Tailscale, and unrelated services unchanged.
- **Reason:** The Pis already host other Node applications, and one user-run command is simple to repeat without SSH access from the build session. An isolated runtime avoids changing those applications; loopback plus Tailscale HTTPS preserves per-device browser geolocation without opening a LAN listener; scoped removal makes trying another host reversible.
- **Status:** Approved.
