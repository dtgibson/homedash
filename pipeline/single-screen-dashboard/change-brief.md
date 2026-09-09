# Change Brief — Single-screen Dashboard

## What is changing
Recompose the existing toolbar plus Dawn and Dense views so weather/daylight, the eBird month comparison and selected target list, llmdash quota windows, and configured bookmarks fit within one viewport without vertical document scrolling. Preserve every current value, provenance label, source state, control, category, source-owned order, display mode, and appearance choice. Likely implementation surfaces are `src/styles.css`, `src/components/DawnView.tsx`, `src/components/DenseView.tsx`, and the existing widget components only where tighter markup is needed; extend `src/App.test.tsx` and `tests/e2e/dashboard.spec.ts` for viewport-fit and content-parity coverage. Server routes, contracts, persistence, deployment, and source logic are out of scope.

## Why now
The shipped page's large Dawn masthead, generous section spacing, and responsive stacking—and Dense's stacked phone rows—push the current capped target list and five configured bookmarks below the fold. That defeats homedash's original one-glance start-page purpose and makes routine scanning require repeated scrolling.

## User-facing impact
Both existing presentations become more compact and viewport-aware on desktop and phone, with the full dashboard visible at once. Dawn must retain its editorial character and Dense its scan-first character; readability, keyboard focus, touch targets, light/dark contrast, and independent failure states must not regress.

## Design pass
Needed — this refines the layout, visual hierarchy, spacing, typography, and responsive behavior of the existing toolbar, masthead, weather, birding, coding-runway, bookmarks, and source-state surfaces. The result should feel like one deliberately composed instrument panel rather than a sequence of vertically stacked sections.

## Decisions touched
- **homedash v1: device-owned presentation** — both Dawn and Dense change presentation while continuing to render one normalized state and keep mode/appearance preferences local to each browser.
- **homedash v1: authoritative sources and isolated failures** — the tighter composition must retain source values, configured bookmark order, closest-first targets, provenance, freshness, and per-source loading/error behavior.

## What done looks like
With the normal maximum five-target result and the current five bookmarks, Dawn and Dense show the same complete data and controls without clipping, overflow, or document scrolling at representative 360×800 phone and 1440×900 desktop viewports. Automated checks cover both modes and content parity; manual review confirms long labels, source-state notes, focus, and touch controls remain readable and usable.
