# Strategic Brief — Mobile Bookmark Targets and Favicons

## What We're Building
Refine the existing bookmark surface in Dawn and Dense so phone links have a 48×48 CSS-pixel target baseline, stronger label-and-icon recognition, and the normal five bookmarks remain immediately reachable at 360×800. Add best-effort favicons through a bounded same-origin resolver, with the bookmark name always primary and a stable neutral fallback when an icon is unavailable.

## Why Now
Daily use has exposed a gap between passing the current 44×44 minimum and feeling effortless to scan and tap in the compact mobile bookmark grid. Bookmarks are one of homedash's four founding widgets and a frequent start-page action, so improving them strengthens the core one-glance promise without adding another widget or management workflow. Doing the target and favicon work together lets the layout absorb the new visual content without reopening the document-scrolling problem.

## The User Problem
On a phone, the single owner must distinguish several small text links and aim precisely even though the destinations are familiar. The current links provide no visual recognition cue, while simply adding icons or space could push content below the established viewport budget. The user needs recognizable, forgiving bookmark actions that stay complete, ordered, and immediately available.

## Success Criteria
- Every bookmark link in Dawn and Dense has at least a 48×48 CSS-pixel mobile hit area, clear separation from adjacent links, and a visible keyboard-focus treatment.
- With the normal five-bookmark/five-target payload, every bookmark is visible without document or bookmark-region scrolling at 360×800; the full dashboard also retains its 1440×900 fit.
- A successfully resolved favicon appears beside its bookmark name without changing the link's accessible name; unsupported, delayed, malformed, or failed icons resolve to the same neutral fallback without layout shift.
- Bookmark names and navigation work immediately and remain usable when favicon retrieval is slow or unavailable.
- Dawn and Dense render the same host-configured bookmark list, groups, URLs, and file order; favicon availability never changes membership or ordering.
- Automatic icon traffic from the browser stays same-origin, introduces no third-party favicon service, and does not require broadening the current external image CSP.
- Shorter viewports and larger bookmark payloads retain the established source-owned overflow behavior instead of creating document scrolling.

## Scope
- Refine the existing mobile bookmark layout, spacing, typography, icon placement, touch geometry, and focus/pressed states in both presentations.
- Add a same-origin favicon route keyed by the existing bookmark identifier; the server derives the only eligible origin from the validated host configuration rather than accepting a client-supplied URL.
- Resolve only a conventional favicon from the configured origin with bounded HTTP(S) retrieval, same-origin redirect handling, response validation, time and byte limits, and a bounded in-memory cache.
- Render favicons as progressive, decorative enhancement while keeping the bookmark name as the semantic link label and showing a neutral fallback in identical geometry.
- Cover mobile target dimensions, one-screen viewport fit, host-order parity, icon success/failure, resolver abuse cases, cache bounds, accessibility, and unchanged bookmark navigation in automated tests.

## Out of Scope
- Adding, editing, deleting, grouping, or reordering bookmarks in the page.
- A new bookmark store, durable favicon cache, uploaded/custom icons, or persisted per-bookmark icon settings.
- Direct browser requests to bookmark sites, third-party favicon aggregators, broad webpage scraping, or arbitrary URL-proxy behavior.
- Eliminating source-region scrolling for unusually short viewports or bookmark payloads beyond the normal five-item contract.
- New widgets, a third display mode, accounts, public-internet exposure, analytics, or changes to bookmark destination behavior.

## Key Decisions
- This feature serves the founding single-owner, mobile-friendly start-page strategy; it does not broaden homedash into bookmark management.
- Mobile bookmark targets move beyond the existing nominal 44×44 baseline to a 48×48 minimum in both Dawn and Dense.
- The host bookmark file remains authoritative for names, destinations, grouping, and display order; the existing bookmark envelope and browser snapshot schema remain unchanged.
- Favicons are optional presentation data, never source-of-truth bookmark data. Names remain visible and actionable at all times, and icons are decorative to assist recognition rather than replace text.
- Favicon acquisition stays behind a same-origin, bookmark-ID route. It may request only the fixed conventional icon path on the exact configured origin, follows no cross-origin redirect, sends no browser credentials, and never accepts a caller-selected host, URL, or path.
- Icon retrieval uses only bounded, replaceable in-memory caching. Failure is isolated to the icon and falls back silently; it cannot delay the bookmarks response, disable navigation, or affect another widget.
- The established one-glance contract remains: normal content fits at 360×800 and 1440×900, while exceptional overflow belongs to the bookmark region.
