# Design Spec — homedash v1

## Visual Direction

Homedash has two complete presentations over one normalized data set.

- **Dawn** is the editorial morning view: an atmospheric tinted ground, a large
  serif greeting and temperature, visible daylight arc, open compositions, and
  one sharp gold accent. Content is grouped by rhythm, rules, and proportion
  rather than a generic grid of equal cards.
- **Dense** is the fast scanning view: a single mono-led reading column with
  hairline-separated sections, compact facts, and no card shells. It preserves
  the same readings, provenance, target order, and source states as Dawn.

Density and appearance are independent axes. Dawn and Dense each work in
System, Light, and Dark appearance. System is the default and follows the
device while the page is open. Both choices persist only in the current
browser.

The visual character is warm, observant, and useful rather than futuristic or
dashboard-generic. Tinted parchment neutrals carry the light palette; warm
charcoal and sand carry the dark palette. Gold is the singular interaction and
daylight accent, green identifies birding, and llmdash retains restrained
Claude terracotta and Codex blue identities.

## Screens / Views

### Dawn

A fluid single page, centered at a maximum width of 1440px.

- **Preference toolbar:** Sticky on tablet and desktop, then static on phone.
  It contains the homedash wordmark, a Dawn/Dense segmented control, a
  System/Light/Dark segmented control, device-location retry, and refresh-all.
  The selected segment uses a gold bottom rule rather than a pill.
- **Morning masthead:** Date kicker, prominent personal greeting, one-sentence
  editorial summary, and a daylight arc. The arc names sunrise, sunset, and
  total daylight in text; the SVG is supplementary and hidden from assistive
  technology.
- **Weather story:** The main focal area. The current temperature is the largest
  figure on the page, followed by condition copy, high/low, precipitation,
  forecast hours, sunrise, sunset, and location provenance.
- **Birding pulse:** Month-to-date distinct species and signed year-over-year
  difference precede nearby targets. Lifers, Photo, and Audio tabs switch one
  target list. Every list explicitly says `closest first`, shows distance as a
  right-aligned value, and is sorted by numeric distance ascending. Equal
  distances use the most recent observation first; unknown distances come last.
- **Coding runway:** One full-width ruled band compares Claude and Codex 5-hour
  and weekly remaining headroom. Each row shows provider, window, percent,
  simple meter, and reset. The explanatory copy names which tool has the better
  short and weekly runway without recomputing llmdash data.
- **Places to go:** Four bookmark groups follow source order. They are link
  columns with rules, not cards. Bookmark editing is intentionally absent.
- **Prototype state preview:** The design artifact alone includes a footer
  selector for Live, Loading, Stale/partial, and Source error. It demonstrates
  state geometry and failure isolation and is not a production dashboard
  control.

### Dense

A single fluid scanning column, centered at a maximum width of 1060px.

- **Header:** Compact greeting, date/time, and source-health summary.
- **Weather row:** Temperature, condition, high/low, precipitation, location,
  hourly values, sunrise, and sunset remain in one wrapping section.
- **eBird row:** Month comparison, `within 50 km · closest first` context,
  category tabs, then the same target records as Dawn. At desktop widths each
  target is one species/place/distance/time scan line. On phone it becomes a
  two-line row with a minimum 44px interaction rhythm.
- **llmdash row:** Claude and Codex each retain two labeled quota windows. No
  value is inferred when absent.
- **Bookmarks row:** The same four groups and source order as Dawn. Phone links
  grow to 44px touch rows even though the desktop direction is deliberately
  denser.

### Responsive behavior

- **901px and wider:** Dawn uses a 7/5 weather-to-birding split and a three-part
  coding band. Four bookmark columns remain visible. Dense uses label and
  content columns.
- **681–900px:** Dawn weather and birding stack with a full-width divider;
  coding providers remain two-up below their introduction; bookmarks become
  two columns. Dense quota windows stack under each provider label.
- **360–680px:** The toolbar wraps into 42px controls; Dawn uses a single flow,
  a horizontally scrollable five-hour forecast strip, two-column weather
  facts, one coding column, and one bookmark column. Dense removes its label
  rail and uses full-width sections. Target records become two-line rows and
  bookmark links become 44px high.
- Both views must fit without document-level horizontal scrolling from 360px to
  1440px. The forecast strip may scroll inside its own bounded region on phone.

## Component Usage

The implementation uses React, Tailwind CSS, and Radix UI primitives while
retaining semantic HTML. Radix provides behavior for segmented controls and
future popovers; it does not supply the visual language.

- **`PreferenceToolbar`:** One labeled group for display mode and one for
  appearance, plus location and refresh buttons. Every current value is exposed
  with `aria-pressed`.
- **`SunArc`:** Responsive inline SVG plus a textual sunrise/daylight/sunset
  row. Geometry reflects actual daylight progress; it is not a decorative
  looping animation.
- **`WidgetState`:** Shared loading, fresh, stale, unavailable, and partial
  treatment. Stale keeps last-good data visible. Error replaces only the failed
  source and includes one clear retry.
- **`LocationProvenance`:** Place label plus Current, Last known with age, or
  Home. Exact coordinates are never displayed.
- **`TargetCategoryControl`:** Three text tabs—Lifers, Photo, Audio—with count,
  pressed state, and green underline. It drives one shared sorted target array;
  both view renderers consume that array without reordering it.
- **`TargetList`:** Species, locality, distance, and observation time. Sort
  known distances ascending, use observation time descending only for ties,
  place unknown distances last, collapse duplicate species before sorting, and
  cap after sorting. This rule applies to every category including lifers.
- **`QuotaWindow`:** Provider, time-window label, supplied remaining percent,
  meter, and supplied reset. Unavailable values render an em dash plus text,
  never a reconstructed number.
- **`BookmarkGroup`:** Source-ordered links under one small mono category label.
  Dawn adds a subtle arrow; Dense stays text-only.
- **`StatusToast`:** A small bottom-corner live region for preference,
  refresh, and location feedback. It never contains essential information that
  is absent from the originating control or widget.

## Design Tokens Applied

The canonical reusable tokens and rationale live in
`pipeline/design-system.md`. The prototype uses the approved values directly.

- **Display:** Iowan Old Style / Palatino / Book Antiqua / Georgia fallback.
  Used for Dawn greeting, temperature, story headings, and prominent species
  count.
- **Body:** Avenir Next / Avenir / Segoe UI / sans-serif fallback. Used for
  prose, conditions, locations, and bookmark names.
- **Data:** SFMono-Regular / Menlo / Monaco / Consolas / monospace fallback with
  tabular numerals. Used for controls, labels, times, percentages, distances,
  provenance, and all Dense content.
- **Light:** ground `#f2eee4`, deep ground `#e8e1d2`, surface `#f8f4ea`, raised
  surface `#fffaf0`, ink `#29261f`, soft ink `#5f5a4e`, faint ink `#817a6a`,
  line `#cfc6b3`, strong line `#9f9581`.
- **Dark:** ground `#1b1915`, deep ground `#12110f`, surface `#24211b`, raised
  surface `#2a261e`, ink `#f2ead9`, soft ink `#b9b09e`, faint ink `#898171`,
  line `#3c372d`, strong line `#625a49`.
- **Semantic accents:** gold `#a9610d` / `#dfa044`, bright gold `#c27712` /
  `#f1b55c`, bird green `#2f7959` / `#7cbd91`, Claude `#b45131` / `#df805e`,
  Codex `#336fa0` / `#73a9d5`, danger `#a54231` / `#eb8c77`.
- **Shape:** 4–5px control corners; content regions are predominantly unboxed
  and separated with 1px rules. The status toast is the sole strongly elevated
  surface.

## Interaction Notes

### Preference behavior

- First visit resolves to Dawn + System.
- Choosing Dawn/Dense immediately switches renderer without navigation,
  refetching, or data loss and writes `homedash.preferences.v1`.
- Choosing System/Light/Dark immediately changes the palette and persists in
  the same preference record. System listens to `prefers-color-scheme` changes
  while open.
- Invalid or unavailable storage falls back to Dawn + System without blocking
  the page.

### Data behavior

- Refresh starts weather, eBird, and llmdash independently. The button is
  disabled and its icon rotates while work is pending. Completion is announced
  through the live region; one failed widget does not block others.
- Location retry reports requesting, success, denial, unsupported, or fallback
  result. Successful current location updates weather and nearby targets.
- eBird category changes are immediate, update both renderer states, and retain
  closest-first order. The visible list is sorted before its five-item cap.
- Loading uses static line placeholders rather than continuous shimmer. Stale
  retains values with explicit age and issue. Partial llmdash keeps the valid
  provider/window visible. Errors use plain recovery text and a retry button.

### Exact motion specification

- Mode and appearance segment background/color: **160ms ease**.
- Toolbar action border/color/background: **160ms ease**.
- Target-tab text and underline: **150ms ease**.
- Bookmark hover text and 5px leading shift: **150ms ease**.
- Status-toast opacity and 18px vertical entry/exit: **180ms ease**; it remains
  readable for **2600ms** before exit. The dwell time is not an animation.
- Refresh/location busy icon: **280ms linear per rotation**, only while the
  explicit request is pending.
- Renderer switch and resolved theme application: **immediate**, with no page
  crossfade or entrance animation.
- Sun-arc progress changes, when live data changes, may interpolate its path for
  **220ms ease**; it never loops.
- No scale-on-hover, parallax, bounce, elastic easing, staggered entrance, or
  decorative continuous motion.
- Under `prefers-reduced-motion: reduce`, all transitions and animations resolve
  to **0.01ms** with one iteration; loaders remain legible without motion.

## Content Notes

- Voice is concise and observational: “Low clouds, then clear,” “Coding
  runway,” and “Birding pulse.” It should feel like a useful morning note, not
  a system console pretending to be conversational.
- Every number in `design.html` is sample data. The prototype must retain its
  explicit sample-data footer until wired to normalized API responses.
- The place name is paired with Current, Last known plus age, or Home; precise
  coordinates never enter UI copy or URLs.
- Weather content names temperature, condition, high, low, precipitation,
  sunrise, and sunset. Stale copy includes age and why last-good data remains.
- Target headings always name the radius and `closest first`. Every target row
  keeps distance visible where known. Sorting is distance ascending, then
  observation time descending for equal distances, with unknown distance last.
- Monthly comparison names the partial date range so an in-progress month is
  never presented as a complete period.
- llmdash copy says remaining headroom and reset; it never converts missing
  source values or exposes private upstream addresses.
- Bookmarks preserve host configuration order and do not imply in-page editing.
- Loading, stale, partial, empty, permission-denied, configuration, and source
  error language must be specific to the failed source and include a useful
  next action where one exists.
