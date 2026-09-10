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

## Single-screen dashboard: bounded one-glance layouts — 2026-09-08

**Decision:** Extend the device-owned presentation decision so Dawn and Dense fit the normal five-target/five-bookmark payload without document scrolling at 1440×900 and 360×800, while shorter viewports or larger payloads scroll only inside the affected source region.
**Rationale:** Homedash is a one-glance start page, but preserving complete source data and usable controls is more important than forcing atypical content into the normal viewport budget.
**Implications:** Future layout and content changes must preserve the target viewport budgets in both presentations and keep exceptional overflow owned by its source instead of expanding the document.

## Five-build Spool: actionable and immediate context — 2026-09-09

**Decision:** Make existing dashboard context actionable through deliberate Kagi and constrained launch links, hydrate validated last-good readings before independent live refreshes, add a coarse local moon phase within daylight context, and treat bounded same-origin favicons as optional bookmark presentation.
**Rationale:** These additions shorten frequent morning journeys and improve return-load usefulness and recognition without adding another widget, data authority, or failure dependency.
**Implications:** Search sends a query only on submission; private launch destinations remain server-owned; cached values stay visible and honestly marked during refresh; lunar text makes no precision or weather-source claim; and favicon failure never changes bookmark semantics.

## Settings and shared bookmark ownership — 2026-09-09

**Decision:** Supersede the host-only bookmark-editing boundary with a single-owner Settings workflow while keeping one private host document as the durable authority; drafts remain memory-only and saves replace the complete ordered-section document through revision checks and verified atomic persistence.
**Rationale:** Routine bookmark maintenance should be possible from the device where it is noticed without creating a competing browser store or risking partial, stale, or silent overwrites.
**Implications:** Device presentation preferences remain local, legacy flat files migrate only on a confirmed save, stale editors must reload instead of force-overwriting, and bookmark state reaches the dashboard only after authoritative save confirmation.

## Production deployment authority — 2026-09-09

**Decision:** Codex prepares and verifies deployment scripts locally but does not access or change production machines; the user alone chooses the safe deployment window, runs the script on production, and reports its result.
**Rationale:** Production access and timing belong to the operator, while local automation and verification remain useful preparation work.
**Implications:** Future release work must stop at a ready, locally verified user-run script and treat the user's reported output as the deployment result.

## Automatic local tide station selection — 2026-09-10

**Decision:** When the private tide station setting is blank, Homedash chooses the nearest eligible active NOAA tidal water-level station on the server from the same current, recent last-known, then Home location used by weather; a valid private fixed station and label remain an override.
**Rationale:** Tide should work on a newly installed device without duplicating location setup, while station selection and private location data stay inside Homedash and the operator can still choose a more hydrologically relevant station than the geometric nearest.
**Implications:** NOAA receives no coordinates for station discovery, the browser receives a validated station name but no station ID or coordinates, and any future distance or regional eligibility rule must preserve the fixed override and isolated tide failure behavior.
