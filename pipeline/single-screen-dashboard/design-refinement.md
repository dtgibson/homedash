# Design Refinement — Single-screen Dashboard

> Approved refinement for implementation. The corresponding interactive reference is `design.html`.

## Visual Direction

The established homedash system remains intact: warm editorial Dawn, mono-led Dense, parchment/charcoal appearance choices, daylight gold, eBird green, and provider-specific llmdash accents. The refinement changes composition and density rather than identity. Dawn becomes one editorial instrument panel with three related vertical regions; Dense becomes a viewport-sized scan table. Both prioritize instant orientation and keep the normal five-target/five-bookmark payload visible without document scrolling.

## Screens / Views

### Dawn

At 1440×900, the compact masthead preserves the date, greeting, synthesized lede, and full daylight arc in one band. Greeting and lede are a contained vertical text block with explicit shrink boundaries; they never share a horizontal flex line or intrude into the daylight column. At tablet widths, the daylight column narrows to 210–240px so the full lede can wrap naturally inside its own pane. Below it, weather, birding, and the paired coding/bookmark utility rail form a 3-column editorial composition rather than a stack of equal cards. The 3-column ratio keeps temperature as the focal point, gives the five-row target list enough reading width, and groups the two lower-frequency utilities without changing source order or hierarchy.

At 360×800, the same story is recomposed into three vertical bands under a single-row toolbar: a 128px weather summary, a flexible birding region, and a 148px utility pair. The masthead compresses to 60px but retains date, greeting, lede, and textual sunrise/daylight/sunset. Weather facts are not discarded: current, apparent, high, low, condition, precipitation, wind, the five hourly readings, location provenance, sunrise, sunset, and total daylight remain present between the masthead and weather band. The explicit four-item weather fact list collapses because those values are already repeated in the compact summary.

The target list retains five closest-first records with species, distance, locality, and observation time. Category tabs remain 42px touch targets. Target records themselves are non-interactive and use a compact two-line rhythm. The five configured bookmarks preserve host order and use a two-column, three-row mobile arrangement; every link remains at least 42px high.

### Dense

Dense stays visually separate from Dawn: no editorial cards, no large display numerals beyond what is needed for reading, and no decorative arc. A compact status header precedes four ruled source rows. Desktop retains the label rail and a single scan column. Mobile removes the rail, gives eBird the flexible middle region, and allocates explicit height to weather, llmdash, and bookmark rows so the normal payload fits without scrolling.

All weather values, the partial-period month comparison, target radius/order, five target records, both provider windows, reset times, five bookmarks, provenance, and source freshness stay visible. Dawn/Dense and System/Light/Dark remain independent controls.

### Source-state preview

The mockup adds a clearly labeled prototype-only States control. It previews independent loading, stale/partial, and isolated weather/eBird failure treatments without proposing a new shipped feature. The normal Live state is the viewport-fit acceptance state; state previews demonstrate geometry and recovery language.

## Component Usage

- Existing Radix Toggle Group behavior remains the implementation target for display mode, appearance, and eBird category controls; the prototype uses equivalent semantic button groups because it is self-contained.
- `Toolbar` retains every existing preference and source action. Mobile hides action text but preserves accessible names and 42px targets.
- `SunArc` retains its real progress path and textual sunrise, sunset, and duration. Its geometry becomes shallower rather than being removed.
- `DawnWeather` is visually compacted into a focal lockup plus a five-column forecast band. Repeated facts collapse only on phone, where the same values already appear in the lockup or masthead.
- `TargetTabs` and `TargetList` keep one shared category selection and source-owned closest-first ordering across renderers.
- `DawnProvider` and `DenseProvider` preserve supplied remaining percentages and reset labels; unavailable fields must still render an em dash plus `unavailable`.
- `BookmarkGroups` preserves group and link order. Mobile uses CSS grid placement only; the DOM/source order does not change.
- `WidgetState` continues to replace only the failed source. Stale and partial states retain last-good values.

## Design Tokens Applied

No new visual tokens are introduced. The prototype uses the canonical light/dark values from `pipeline/design-system.md`, including `--ground`, `--surface-raised`, `--ink`, `--line`, `--gold`, `--green`, `--claude`, `--codex`, and `--danger`. Dawn continues to use Iowan Old Style/Palatino fallbacks for display, Avenir Next/Segoe UI for body, and SF Mono/Menlo for data and labels. Dense remains mono-led. Corners stay at 4–5px, structural regions stay unboxed, and the only elevation belongs to transient status/prototype surfaces.

New density values are derived from the existing 4/8/10/12/16/18/24 spacing family. Desktop toolbar controls remain 36px because pointer environments do not require mobile touch sizing; at 680px and below they become 42px. Bookmark links and eBird category controls remain at least 42px on phone.

## Interaction Notes

- Renderer and appearance switches apply immediately and preserve one shared data/category state.
- The target category control updates both renderers, retaining closest-first order and the five-item cap.
- Refresh and location actions keep their existing disabled/busy/status behavior. The layout must not resize when their labels change.
- The normal mobile composition is intentionally viewport-bound. Long species/place labels use single-line ellipsis in the compact canvas, with the full string retained in the DOM and exposed through `title`; implementation should add an accessible focus/tap disclosure only if real configured data demonstrates that ellipsis materially hides needed distinctions.
- The viewport-fit acceptance test should use `scrollHeight <= clientHeight` and `scrollWidth <= clientWidth` at 1440×900 and 360×800 for Dawn and Dense with five targets and the five current configured bookmarks.
- Shorter viewports below 800px are not part of this change brief’s no-scroll guarantee. The implementation should prefer internal source-region scrolling over document scrolling if it chooses to support them.

## Motion Spec

- Mode and appearance selection: `ease`, 160ms, control baseline/trigger, 0.01ms under reduced motion, CSS (production may use Motion only if state choreography grows).
- Target category underline/text: `ease`, 150ms, selected tab baseline, 0.01ms under reduced motion, CSS.
- Bookmark hover/focus leading shift: `ease`, 150ms, link left edge, no transform under reduced motion, CSS.
- Source-state review popover (prototype only): `cubic-bezier(.16, 1, .3, 1)`, 180ms, top-right trigger, immediate opacity with no scale/translate under reduced motion, CSS.
- Status toast enter/exit: `cubic-bezier(.16, 1, .3, 1)`, 180ms, bottom-right edge, immediate opacity with no translate under reduced motion, CSS; 2600ms dwell is not animated.
- Refresh busy rotation: `linear`, 280ms per turn while pending, icon center, one near-instant iteration under reduced motion, CSS.
- Daylight progress update: `ease`, 220ms, SVG path start, immediate stroke update under reduced motion, CSS.
- Renderer and resolved appearance change: immediate, no transform origin, identical under reduced motion, CSS state application.

## Content Notes

- The mockup uses realistic sample readings, not live user data.
- Dawn copy remains concise and observational. Dense uses plain source language and tabular facts.
- Location always pairs place with `current device`, `last known · age`, or `home`; coordinates never appear.
- The eBird month comparison always states the partial period and prior-year equivalent. The target context always includes radius and `closest first`.
- llmdash values are copied from the source. No percentage or reset is inferred.
- Bookmarks retain current host-configuration order: Gmail, Calendar, GitHub, eBird, Macaulay Library.
- Error and loading copy remains source-specific, and one source’s failure never displaces the others.

## Implementation Considerations

- The 360px composition is intentionally dense. It passes the stated normal-payload goal, but unusually long translated labels, larger user font settings, or more than five bookmarks/targets will require a fallback. The recommended fallback is bounded scrolling inside the affected source region, not document scrolling.
- Dawn’s repeated weather fact row is visually hidden on phone only because the same values remain elsewhere on-screen. Engineering tests should assert content parity semantically rather than requiring duplicated text nodes.
- The prototype uses 42px mobile controls to match the shipped system. If the team elects to raise the system-wide minimum to 44px, the toolbar will need either a second row or a compact overflow treatment at 360px.
