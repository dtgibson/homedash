# Project Decisions

## homedash v1: device-owned presentation — 2026-09-08

**Decision:** Dawn and Dense render one normalized dashboard state, while display mode, System/Light/Dark appearance, current location, and last-known location remain local to each browser.
**Rationale:** Each phone or computer should adapt to its own display and physical location without changing another device or duplicating source logic.
**Implications:** Every future widget needs both Dawn and Dense treatments over one data contract, and remote current-location access continues to require a secure browser context.

## homedash v1: authoritative sources and isolated failures — 2026-09-08

**Decision:** eBird remains the birding source of truth through SnowRaven, llmdash remains the coding-headroom source of truth, and bookmark file order remains the display order; homedash normalizes these sources but does not create competing records or infer missing values.
**Rationale:** Reusing authoritative personal data prevents drift, while independent endpoints and last-good snapshots keep the dashboard useful during partial outages.
**Implications:** New sources must declare freshness and failure behavior, and nearby eBird targets remain canonically deduplicated and sorted by known distance before recency and result limits.

## homedash v1: private Raspberry Pi lifecycle — 2026-09-08

**Decision:** Distribute homedash from a public, secret-free repository through one bootstrap command that installs or updates an isolated Node.js 22 runtime, a restart-on-failure systemd user service on loopback port 1910, and a dedicated Tailscale HTTPS listener; the same bootstrap supports a scoped uninstall with a private-configuration backup.
**Rationale:** A user-run command is easier to repeat across Pis, an isolated runtime cannot disrupt existing Node applications, and Tailscale HTTPS provides the secure context needed for per-device geolocation without opening a LAN or public listener.
**Implications:** Secrets and personal configuration must never enter the repository, upgrades must preserve them, removal must leave system Node.js and unrelated services untouched, and broader exposure requires authentication and rate limiting to be reconsidered.
