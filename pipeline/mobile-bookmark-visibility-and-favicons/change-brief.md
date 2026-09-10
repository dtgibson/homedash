# Change Brief — Mobile Bookmark Visibility and Favicons

## What is changing
Refine the existing Dawn and Dense bookmark surfaces so the five normal mobile links are visibly prominent, comfortably separated, and never covered by dashboard chrome or transient notices. Strengthen the existing favicon enhancement with bounded server-side recovery for safe icon redirects and a locally rendered, bookmark-specific fallback when no remote image is usable. Likely code surfaces are `src/components/Bookmarks.tsx`, `src/styles.css`, `src/single-screen.css`, `server/favicon.ts`, and their focused component, resolver, route, and viewport tests; bookmark data, ordering, navigation, and editing remain unchanged.

## Why now
The current phone layout technically reaches the 48×48 floor, but each link is only about 51 pixels wide inside a cramped three-column half-pane and the bottom status toast can cover the second bookmark row. The resolver also rejects otherwise valid conventional icons when sites place them behind cross-origin HTTPS redirects, leaving most of the normal fixture on the generic fallback.

## User-facing impact
Bookmarks become easier to spot and tap in both mobile presentations, stay clear of transient UI, and retain a distinct visual identity even when a remote favicon cannot be accepted. Desktop keeps its established layout while benefiting from additional safe favicon successes and the improved fallback.

## Design pass
Needed — refine the existing mobile bookmark layout, target separation, icon treatment, and toast clearance in Dawn and Dense while preserving the one-glance viewport contract and source-owned exceptional overflow.

## Decisions touched
- **Single-screen dashboard: bounded one-glance layouts** — retain no document or normal bookmark-region scrolling at 360×800 and 1440×900 while prioritizing bookmark reachability.
- **Five-build Spool: actionable and immediate context** — preserve optional, same-origin browser favicon behavior while broadening only the bounded server retrieval and improving the local fallback.
- **homedash v1: authoritative sources and isolated failures** — preserve host order, destinations, and independent bookmark readiness regardless of icon outcome.

## What done looks like
All five normal bookmarks are fully visible, unobscured, non-overlapping, and easier than the current roughly 51×48 targets to tap in Dawn and Dense at 360×800; transient notices do not cover them. Safe redirected icons can render through the same-origin browser route, every rejection remains resource-bounded, and unavailable images show a stable bookmark-specific fallback without changing labels, links, order, freshness, or layout.
