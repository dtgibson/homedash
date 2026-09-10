# Strategic Brief — eBird Distance and Sort Preference

## What We're Building

Tighten Homedash's nearby eBird targets to a ten-mile search area and let the owner order the Birding pulse by nearest sighting or most recent sighting. One per-browser choice follows the owner across Lifers, Photo, and Audio and across Dawn and Dense.

## Why Now

The current 31-mile radius admits targets that are technically nearby but not useful for a quick local decision. Closest-first is a good default, yet a newly reported bird can be more actionable than a slightly nearer older report; the dashboard should let the owner choose which signal matters in the moment without turning birding into a separate workflow.

## The User Problem

The owner scans Homedash to decide where to go, but a broad target radius adds noise and the fixed closest-first order can hide timely sightings. Re-selecting the useful ordering on every visit would also undermine the start page's device-specific convenience.

## Success Criteria

- Nearby eBird target requests and displayed radius resolve to ten miles rather than roughly 31 miles on standard installations.
- The Birding pulse offers two explicit orders: nearest first and most recent first.
- Each order is deterministic, deduplicates species before limiting results, and selects the five displayed targets from the complete qualifying pool rather than merely reordering an already-truncated list.
- One sort choice applies consistently to Lifers, Photo, and Audio and to Dawn and Dense.
- The selected order survives reloads in the same browser without changing another device.
- Existing target-category choice, eBird source freshness, launch links, failure isolation, accessibility, and single-screen viewport behavior remain intact.

## Scope

- A ten-mile nearby-target radius, expressed to the upstream in kilometers and presented to the user in miles.
- Server normalization for distance-first and recency-first ordering, with stable tie-breakers and the existing result cap applied after deduplication and ordering.
- A compact accessible sort control within the existing Birding pulse in both presentations.
- Browser-local persistence with a backward-compatible default to nearest-first.
- Installer handling that updates the known prior managed radius default while preserving an explicitly customized radius.
- Service, contract, preference, renderer, installer, and desktop/mobile browser coverage.

## Out of Scope

- Separate order choices for Lifers, Photo, and Audio or for Dawn and Dense.
- More than two sort modes, arbitrary radius selection, maps, filters, alerts, saved searches, or sighting history.
- Changing SnowRaven or eBird as the source of truth, changing the five-target display cap, or adding a database.
- Persisting sort preference on the server or synchronizing it between devices.
- Production access or deployment performed by Codex.

## Key Decisions

- This is a New Feature because it adds a user-visible sorting capability, even though it refines an existing widget.
- Nearest-first remains the default for existing browsers. It sorts known distances ascending, then newer observations; unknown distances remain last.
- Most-recent-first sorts observation time descending, then known distance ascending for stable ties.
- The choice is shared across target categories and renderers because both presentations are views over one authoritative dashboard state.
- The server applies the requested validated order before the five-item cap so recency can surface a qualifying target that is not among the five closest.
- The radius change preserves private server ownership and migrates only the prior managed default; a deliberate host customization remains authoritative.
