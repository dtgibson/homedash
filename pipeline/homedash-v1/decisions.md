# Decisions — homedash v1

## 2026-09-07 — Default server port

- **Decision:** Homedash defaults to port `1910` for local and Raspberry Pi deployments.
- **Reason:** Explicit user preference.
- **Status:** Approved.

## 2026-09-07 — Closest-first eBird targets

- **Decision:** Lifers, photo targets, and audio targets are ordered by shortest available distance first; recency breaks equal-distance ties, and targets without a distance appear after targets with a known distance.
- **Reason:** The dashboard should surface the most immediately actionable nearby opportunities first in every target category.
- **Status:** Approved.

## 2026-09-08 — Idempotent Raspberry Pi deployment

- **Decision:** Ship one `scripts/install-or-update.sh` entry point for both first installation and future updates. It preserves private configuration, verifies and builds the app, runs homedash as a restart-on-failure systemd user service on loopback port `1910`, and adds a dedicated tailnet-only Tailscale HTTPS listener without replacing existing Serve routes.
- **Reason:** The Pi already hosts other Node applications, and a user-run installer is simpler and safer than granting this session direct SSH access. Loopback plus Tailscale HTTPS also preserves per-device browser geolocation without opening a LAN listener.
- **Status:** Approved.
