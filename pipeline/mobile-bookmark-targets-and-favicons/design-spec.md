# Design Spec — Mobile Bookmark Targets and Favicons

## Visual Direction

Extend homedash's established warm, editorial Dawn and mono-led Dense
presentations without introducing a new surface or visual language. Favicons are
quiet recognition aids inside the existing ruled bookmark lists: the bookmark
name remains primary, the fallback is intentionally neutral, and larger mobile
targets feel generous without turning the links into tiles or cards.

## Screens / Views

### Dawn

Keep the existing `Places to go` utility section, source freshness line, group
order, and open editorial composition. On mobile, arrange the named groups in
three equal-width columns; each bookmark is a single icon-and-label anchor at
least 48px wide and 48px high, with a 5px gap between the 18px icon slot and the
label. Use the body face for link names, preserve the ruled group headings, and
allow names to wrap within their own column rather than truncate or widen the
page.

- The normal fixture is `Daily` (Gmail, Calendar), `Projects` (GitHub), and
  `Birding` (eBird, Macaulay Library), in host-file order.
- The success and fallback treatments occupy identical geometry.
- At wider viewports, retain Dawn's existing bookmark-column treatment and
  spacing; the 48px minimum is a mobile requirement, not a new desktop density.
- Keep bookmarks subordinate to the greeting, weather, birding, and coding
  runway hierarchy. Do not introduce an additional card, panel, or heading.

### Dense

Keep the existing `Bookmarks` scan row, hairline separators, and mono-led
typography. On mobile, remove the label rail as the existing responsive system
does, then use the same three equal-width grouped columns, 18px icon slots, and
48px minimum anchors as Dawn. Dense remains visually plainer than Dawn, but it
does not omit icons, names, source order, fallback behavior, or focus treatment.

- Use the same `BookmarkGroups` data and link destinations as Dawn.
- Link labels use the mono face and compact Dense scale; icon geometry and
  target geometry remain shared.
- At wider viewports, retain Dense's existing scan-row density and three-column
  bookmark treatment.
- Do not add arrows, badges, icon-status copy, or a second freshness state.

### Bookmark States

The shared bookmark surface must support four proof states in both views:

- **Mixed success and fallback:** representative successful favicons appear
  beside a neutral local fallback without changing layout.
- **All fallback:** every link remains named, enabled, and navigable while the
  same neutral bookmark glyph fills each reserved slot.
- **Long labels:** complete names wrap with `overflow-wrap: anywhere`; unusually
  tall content is owned by the bookmark region.
- **Keyboard focus:** the focused anchor shows the existing 2px bright-gold
  outline, 3px offset, and at least 5px of unclipped clearance.

## Component Usage

- Extend the existing shared React `BookmarkGroups` component; it remains the
  sole owner of grouping, host-file order, and Dawn/Dense parity.
- Add one small shared `BookmarkFavicon` presentational component inside each
  native anchor. It owns an 18px square slot, renders the local fallback first,
  and may replace only the slot contents with a decorative same-origin image.
- Keep each complete icon, label, and padded row inside one native `<a>` using
  the configured bookmark URL. Do not add scripted navigation, nested buttons,
  popovers, tooltips, or forced new-tab behavior.
- Continue using the existing customized Radix `ToggleGroup` controls for Dawn,
  Dense, System, Light, and Dark. No new library component is required for the
  bookmark treatment.
- Use the existing bookmark-owned scroll wrapper for exceptional vertical
  overflow. Do not add a document scroller or horizontal carousel.
- Prototype-only canvas and bookmark-proof controls are not production UI.

## Design Tokens Applied

- **Color:** use the established light/dark pairs for `--ground`, `--surface`,
  `--ink`, `--ink-soft`, `--ink-faint`, `--line`, `--line-strong`, `--gold`,
  `--gold-bright`, and `--gold-wash`. No new global color token is introduced.
- **Typography:** Dawn bookmark names use `--body`; Dense names and all group
  labels use `--mono`. Existing display, body, label, and metadata roles remain
  unchanged elsewhere on the page.
- **Icon slot:** 18px square in both modes and all appearances, with a 1px
  `--line-strong`-derived border, 4px radius, and `--surface` background. The
  local outline glyph is 12px and uses `--ink-faint`.
- **Mobile anchor:** at viewports of 680px or less, `min-width: 48px`,
  `min-height: 48px`, 5px internal icon/label gap, and 4px block / 2px inline
  padding. Adjacent column gaps are 7px and row gaps are 2px.
- **Focus:** 2px `--gold-bright` outline with 3px offset; reserve 5px around the
  scroll content so the outline is never clipped.
- **Hover:** link text uses `--gold-bright` over `--gold-wash`; hover does not
  change target size, icon size, or position.
- **Shape and depth:** preserve the existing ruled-list treatment, square-edged
  composition, tinted atmosphere, and shadow-free bookmark region. Only the
  existing status toast uses raised-surface elevation.

## Interaction Notes

- Render the neutral fallback on first paint so the label and target are ready
  independently of icon network state. Request only
  `/api/bookmarks/{encodedBookmarkId}/favicon` after the bookmark renders.
- On a successful image load, replace the fallback pixels in place. On an HTTP
  failure, decode error, timeout, or rejected response, retain or restore the
  fallback silently; never expose a broken-image indicator.
- Mark the image decorative with an empty alternative and keep the icon wrapper
  out of the accessibility tree. The anchor's accessible name is always the
  complete visible bookmark name.
- Clicking or tapping anywhere in the icon, label, or target padding activates
  the same native same-tab link. Favicon state never disables, reorders,
  regroups, or changes a destination.
- Mode and appearance changes reuse the same bookmark data and icon URL. They
  preserve group order, link semantics, fallback behavior, and focus styling.
- Keyboard focus must use `preventScroll` behavior where focus is restored or
  demonstrated; ordinary tab navigation must not move the document for the
  normal 360x800 fixture.
- Favicon success or failure must not alter bookmark freshness, source loading,
  stale/error treatment, dashboard refresh progress, or any sibling widget.

## Motion Spec

- Bookmark hover/focus feedback: `ease`, 150ms, anchor center (no transform),
  reduced motion at 0.01ms, CSS transitions.
- Favicon fallback-to-image or image-to-fallback swap: immediate, 0ms, fixed
  18px slot (no transform), unchanged under reduced motion, React + CSS.
- Dawn/Dense and appearance switch: immediate, 0ms, whole renderer (no
  transform), unchanged under reduced motion, React state + CSS variables.
- Existing status-toast acknowledgement: `cubic-bezier(.16, 1, .3, 1)`, 180ms,
  bottom-right edge, reduced motion at 0.01ms, CSS transitions.

No favicon entrance, shimmer, scale, pulse, bounce, or layout transition is
permitted. Motion must explain feedback only and must not suggest that favicon
availability changes bookmark readiness.

## Content Notes

Use the existing human labels: `Places to go` in Dawn and `Bookmarks` in Dense.
Group names and bookmark names come verbatim from the validated host
configuration; do not abbreviate names, replace them with icon-only controls,
or add favicon-status prose. Counts may continue to read `5 bookmarks · host
order`, and freshness language continues to describe the bookmark source—not
the independent cosmetic icon request.

The empty state remains `No valid bookmarks are configured.` Existing loading,
stale, partial, and error copy remains source-specific and unchanged. Favicon
failure is deliberately silent because the stable fallback fully represents
that state.

## Viewport and Overflow Behavior

- **360x800, normal five-bookmark fixture:** Dawn and Dense show every bookmark
  without document scrolling, horizontal overflow, or bookmark-region
  scrolling. Each mobile target is at least 48x48; the approved prototype
  measures approximately 109x48.
- **1440x900, normal fixture:** retain the existing wide-screen compositions
  with no document or bookmark-region overflow.
- **Viewports shorter than 800px or payloads above five bookmarks:** keep the
  document fixed and allow vertical scrolling only inside the bookmark-owned
  region. Every link remains keyboard- and touch-reachable.
- **All supported widths:** never introduce horizontal scrolling. Long labels
  wrap inside their column, and the 5px inset around the scroll content keeps
  the 2px outline plus 3px offset visible at every edge.

