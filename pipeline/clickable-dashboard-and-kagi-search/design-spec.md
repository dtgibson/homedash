# Design Spec — Clickable Dashboard and Kagi Search

> Feature design for `clickable-dashboard-and-kagi-search`. This extends the approved homedash system in `pipeline/design-system.md` and the single-screen refinement without changing canonical tokens or visual direction.

## Design intent

Homedash remains a one-glance morning surface. This feature turns existing readings into useful exits and adds one compact search action in the shared toolbar. It does not add another widget, card, data source, decorative layer, or presentation mode.

- **Dawn** keeps its atmospheric editorial hierarchy: greeting and daylight, weather, birding, then coding runway and bookmarks.
- **Dense** keeps its ruled mono scan: one compact header and four source rows.
- **Shared chrome** owns one Kagi form above the Dawn/Dense fork. A mode switch preserves the typed query because no second form exists.
- **Actionability is quiet but visible.** Existing eBird text becomes linked and underlined; llmdash identity becomes a link; the Kagi control uses the existing gold focus/action color.
- **Miles are presentation copy only.** The mockup retains kilometer values in its sample objects and applies the approved conversion at render time.

## Primary view

The interactive reference is `pipeline/clickable-dashboard-and-kagi-search/design.html`. It opens in Dawn and can switch immediately to Dense. System, Light, and Dark remain independent of presentation mode.

### Shared toolbar and Kagi search

The form sits between the homedash wordmark and the existing preference/source controls on wide screens. It is a 36px-high, square-cornered inline control with three parts:

1. A persistent mono `Kagi` label in gold.
2. A plain body-face search input with `Search the web` placeholder.
3. A right-edge arrow submit control separated by one hairline.

The input receives focus once after the initial document mount. Focus is not repeated after mode, appearance, target-category, location, refresh, or source-state changes. The form uses native GET submission and normal same-tab navigation. Surrounding whitespace is trimmed; an empty result remains on the page and is announced in the existing status region. Query text is not stored, logged, prefetched, or shared with widget state.

At 680px and below, the toolbar becomes two compact rows inside a 100px budget. Search occupies the first row; display, appearance, location, and refresh remain in the second. The prototype-only States trigger is omitted at this width because it is not a shipped product control. Search input and submit remain visible when the software keyboard appears, and every interactive target in both rows retains at least 44px touch height.

## Dawn treatment

The established three-region editorial composition remains unchanged below the toolbar.

### eBird month action

The existing month-comparison block is one semantic My eBird link. Its large species count, partial-period label, prior-year comparison, and delta remain together. `My eBird ↗` appears as a restrained underlined mono cue in the comparison’s right column. This makes the existing context actionable without adding a button row or competing with the green count.

### Target actions and miles

Every visible target row is one semantic link to its species map. The common name has a quiet green-tinted underline at rest and resolves fully green on hover. Keyboard focus uses the system-wide 2px bright-gold outline with 3px offset around the row. Distance, place, and time remain in their existing columns and are part of the same generous activation target.

The target context reads `within 31 mi · closest first`, representing the unchanged 50 km source radius. Sample target values demonstrate both formatter branches: under ten miles uses one decimal (`1.3 mi`, `6.8 mi`) and values from ten miles use a whole number (`17 mi`, `30 mi`).

### llmdash action

The source identity in the Coding runway heading becomes `llmdash · 8:11 ↗`, linked through the fixed same-origin launch route. It sits outside the dynamic source body, so loading, stale, partial, or unavailable quota data never removes the launch affordance. Claude terracotta and Codex blue continue to identify providers only.

## Dense treatment

Dense exposes exactly the same actions and destination semantics in its established scanning grammar.

- Month progress begins with the underlined green link `94 species · My eBird ↗`, followed by the same partial-period comparison and `within 31 mi · closest first` context.
- Target rows remain compact scan records, but the entire row is the map link and reaches a 44px touch rhythm on phone.
- The `llmdash` label rail itself is the source launch link. It remains outside the state-dependent content region.
- The shared Kagi form stays in the toolbar, so Dense does not duplicate or restyle query state.

Dense receives no card shell, oversized display type, icon tiles, or decorative daylight geometry.

## Responsive viewport budget

The normal five-target/five-bookmark fixture is designed to remain within the document viewport at both release sizes.

| Viewport | Shared chrome | Dawn composition | Dense composition |
| --- | ---: | --- | --- |
| 1440×900 | 50px | Existing masthead plus 3-column weather / birding / utility canvas | Header plus four ruled source rows |
| 360×800 | 100px, two rows | 52px masthead; 113px weather; flexible birding; 135px utility pair | 40px header; 70px weather; flexible eBird; 110px llmdash; 120px bookmarks |

The document itself remains overflow-hidden in the design artifact to expose fit errors. Normal content must not rely on clipping to conceal required information. At narrow widths, the five target links and bookmark links use 44px minimum rows. The three bookmark groups share three compact columns, preserving DOM/source order while avoiding a second vertical stack. Long species and locality text uses single-line ellipsis with the complete value retained in `title` and the accessible species label. Oversized real payloads should continue to use the existing source-owned bounded overflow fallback.

## Component guidance

### `Toolbar` / `KagiSearch`

- Render exactly one form above the presentation fork.
- Use `action="https://kagi.com/search"`, `method="get"`, and input `name="q"`.
- Keep a persistent Kagi-specific accessible label and an explicit submit control.
- Guard the mount focus effect so React effect replay and subsequent state updates cannot reclaim focus.
- Trim only on submit. Prevent blank submission. Do not persist the query or add suggestion/prefetch behavior.
- Preserve logical keyboard order: query, submit, display mode, appearance, location, refresh.

### `MonthComparison`

- Render the month context as a native same-tab anchor to `/launch/ebird/my-ebird` in both presentations.
- Keep date span, distinct species count, prior equivalent-period count, and signed delta in the linked context.
- Use an accessible name such as `Open My eBird for September progress`; do not depend on the arrow glyph for meaning.

### `TargetList`

- Build hrefs only from the validated canonical `speciesCode`: `/launch/ebird/map/${encodeURIComponent(speciesCode)}`.
- Use one native anchor per rendered row with an accessible name such as `Open eBird map for American Redstart`.
- Preserve source-owned deduplication, closest-first ordering, recency tie-break, category, and five-row cap.
- Use the shared miles formatter for every displayed target distance. Null remains `distance unknown`.

### `LlmdashSourceLink`

- Use `/launch/llmdash`; never expose the configured destination in client markup or data.
- Keep the link present next to or in the source identity for fresh, loading, stale, partial, and unavailable states.
- Do not style it as a provider-success badge. It is neutral source navigation.

### `formatMiles`

- Convert only at the rendering boundary with `kilometers × 0.621371`.
- Below 10 miles: one fractional digit, including zero.
- At or above 10 miles: nearest whole mile.
- Use the same primitive for target distances and radius context in Dawn and Dense.

## Accessibility and semantics

- Search is a labeled semantic form with native Enter submission and a visible submit button.
- My eBird, target maps, llmdash, and bookmarks are native same-tab anchors. Do not replace them with click handlers, force a new tab, or add popup behavior.
- Every new interactive element uses the existing bright-gold focus outline and remains understandable without color or hover.
- The linked species name carries an underline at rest. Outbound arrows reinforce action but are `aria`-redundant.
- Phone target rows, bookmark links, search input/submit, and toolbar controls are at least 44px high.
- Mode switching sets inactive presentations to `aria-hidden="true"`; the shared toolbar is never duplicated.
- Status feedback uses the existing polite live region and is supplementary to the control’s visible state.

## States and failure isolation

The prototype retains the approved Live, Loading, Stale/partial, and isolated source-error preview. The new links obey the following geometry:

- Kagi remains available regardless of widget state because it is shared chrome.
- llmdash launch remains visible when quota content loads or fails because it is outside `.source-content`.
- My eBird is shown whenever month progress is rendered.
- Species links exist only for rendered targets carrying valid canonical codes; the server remains responsible for rejecting malformed launch paths.
- A launch failure navigates to its safe server error response and never replaces source data in place.

## Tokens and motion

No canonical design-system changes are required.

- Search uses `--surface`, `--line-strong`, `--ink`, `--ink-faint`, `--gold`, and `--gold-wash`.
- eBird action underlines use a low-opacity mix of `--green`; hover resolves to `--green`.
- llmdash source links use `--ink-soft`; provider values retain `--claude` and `--codex`.
- Control radius stays 4px. Widget regions remain unboxed and separated by rules.
- Search border/button feedback uses `160ms ease`; target link color/underline uses the established `150ms ease` family; renderer changes remain immediate.
- Reduced motion forces every animation and transition to `0.01ms` with one iteration.

## Content and privacy notes

- All values, place names, times, and targets in the artifact are realistic sample data, not live readings.
- The llmdash link shows only its public product identity. The artifact contains no Hephaestus hostname, private upstream URL, credential, coordinate, or real private bookmark.
- `mi` is used for eBird target distance and radius copy only. Weather wind remains `mph`; normalized eBird fields remain kilometer-based.
- Copy stays concise: `Search the web`, `My eBird`, `within 31 mi · closest first`, and `llmdash`. No onboarding, explanation panel, or fifth widget is introduced.

## Implementation acceptance

- One Kagi form is visible in both modes and preserves its local value across mode switches.
- Blank submission does not navigate; a submitted query uses native Kagi GET navigation.
- Initial focus happens once and no dashboard interaction steals it back.
- Dawn and Dense each expose My eBird, all five rendered species-map links, and llmdash with equivalent native-link behavior.
- All eBird distance/radius copy uses miles, while source kilometer values and ordering are unchanged.
- Full normal payload fits at 1440×900 and 360×800 with no document-level horizontal or vertical scrolling.
- Light and dark palettes meet the established token system with visible hover and keyboard-focus states.
- Source-state previews preserve the launch affordances and failure isolation described above.
