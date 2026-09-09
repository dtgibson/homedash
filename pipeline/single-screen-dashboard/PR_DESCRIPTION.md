## Single-screen Dashboard

### What this does

Recomposes Dawn and Dense as viewport-bound dashboards so the normal five-target and five-bookmark payload fits without document scrolling at 1440×900 and 360×800. Dawn now uses a contained masthead and three-region editorial canvas, while Dense uses four explicit scan rows; both continue to render the same normalized source data, states, categories, controls, and device-owned preferences.

### How to test

1. Run `npm run check`.
2. Run `npm run test:e2e` to exercise both 1440×900 and 360×800 Chromium projects.
3. Open Dawn with five lifer targets and five configured bookmarks; confirm the masthead summary wraps or truncates only inside its text pane and does not enter the daylight pane.
4. Switch to Dense and confirm weather, month comparison, five targets, both llmdash providers and windows, and five bookmarks remain visible without document or source-region scrolling.
5. Switch Dawn/Dense, System/Light/Dark, and eBird target categories; refresh the page and confirm preferences and shared category/data behavior are unchanged.
6. Exercise loading, stale/partial, and error responses and confirm each source remains independently bounded and retryable.

### Notes for reviewer

- `src/single-screen.css` is intentionally a focused composition layer over the established design system in `src/styles.css`; it introduces no new color or type tokens.
- Dense now explicitly includes apparent temperature, wind, and total daylight so compact mode preserves the complete weather payload.
- Target names and localities retain their full DOM values and expose full strings with `title` where compact rows ellipsize them.
- The no-scroll guarantee targets the approved normal payload at 1440×900 and 360×800. Shorter viewports or unusually long/additional configured content fall back to scrolling inside the affected source region rather than the document.
