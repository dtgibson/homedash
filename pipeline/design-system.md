# Design System — homedash

Reusable visual and interaction reference for every homedash widget and view.
The system supports two presentation modes, Dawn and Dense, across one
independent appearance axis: System, Light, or Dark.

## Feel

Warm, observant, and immediate. Homedash should read like a beautifully edited
morning note assembled from trustworthy local tools—not a collection of SaaS
cards and not a terminal costume.

Dawn uses atmosphere, editorial scale, open composition, and a restrained
daylight accent. Dense uses one quiet scanning column, hairline rules, and
mono-led facts. Both are content-first, truthful about freshness and
provenance, and equally complete. They share semantic color, state language,
source ordering, and data precedence while expressing different density.

The hierarchy is: greeting/daylight context → location-aware weather and nearby
bird opportunity → coding runway → destinations. Future widgets join that
story according to urgency and frequency; they do not default to another equal
card in a grid.

## Tokens

### Color

Canonical CSS custom properties use the following light / dark values:

- `--ground`: `#f2eee4` / `#1b1915`
- `--ground-deep`: `#e8e1d2` / `#12110f`
- `--surface`: `#f8f4ea` / `#24211b`
- `--surface-raised`: `#fffaf0` / `#2a261e`
- `--ink`: `#29261f` / `#f2ead9`
- `--ink-soft`: `#5f5a4e` / `#b9b09e`
- `--ink-faint`: `#817a6a` / `#898171`
- `--line`: `#cfc6b3` / `#3c372d`
- `--line-strong`: `#9f9581` / `#625a49`
- `--gold`: `#a9610d` / `#dfa044`
- `--gold-bright`: `#c27712` / `#f1b55c`
- `--gold-wash`: `rgba(169, 97, 13, .10)` /
  `rgba(223, 160, 68, .11)`
- `--green`: `#2f7959` / `#7cbd91`
- `--green-wash`: `rgba(47, 121, 89, .09)` /
  `rgba(124, 189, 145, .09)`
- `--claude`: `#b45131` / `#df805e`
- `--codex`: `#336fa0` / `#73a9d5`
- `--danger`: `#a54231` / `#eb8c77`
- `--shadow`: `rgba(65, 48, 18, .15)` / `rgba(7, 6, 4, .42)`

Color semantics:

- Gold is the singular product accent: daylight progress, focus, selected
  preference, and deliberate action.
- Green is reserved for eBird identity, positive month deltas, and live source
  confirmation.
- Claude terracotta and Codex blue identify llmdash providers. They never imply
  success or failure.
- Danger appears with explanatory error text and recovery action. State never
  depends on hue alone.
- Faint ink is for labels and supplementary metadata only. Do not use it for
  essential instructions or body copy on a colored wash.

Atmosphere may use one low-opacity gold radial wash and one green radial wash
over a tinted ground. Do not add blue/purple auroras, glass-card stacks, or
heavy shadows. `--surface-raised` and `--shadow` are reserved for transient
feedback or a future focus-preserving popover.

### Typography

- `--display`: `"Iowan Old Style", "Palatino Linotype", Palatino,
"Book Antiqua", Georgia, serif`
- `--body`: `"Avenir Next", Avenir, "Segoe UI", sans-serif`
- `--mono`: `"SFMono-Regular", Menlo, Monaco, Consolas, monospace`

Roles:

- **Dawn greeting:** 48–94px display, 400, `.95` line height, `-.045em`.
- **Dawn primary reading:** 96–178px display with lining, tabular numerals;
  `.75` line height and `-.075em` for the temperature only.
- **Story heading:** 30–44px display, 400, approximately `1` line height.
- **Editorial lede:** 18–25px display, 400, `1.45` line height.
- **Body:** 12–14px body face, `1.45–1.6` line height.
- **Dense primary:** 13–14px mono, 600, tabular numerals.
- **Data/value:** 10–20px mono, 500–600, tabular numerals.
- **Kicker/label:** 9–10px mono, 600, uppercase, `.09–.16em` tracking.
- **Metadata:** 9–10px mono, 400–500, tabular where relevant.

Keep at least these three roles visible in Dawn: display, body, and mono. Dense
is intentionally mono-led, but the shared toolbar still establishes product
identity. Do not substitute generic geometric display faces or use all-mono in
Dawn.

### Spacing and shape

- Base spacing increments: `4, 8, 10, 12, 16, 18, 22, 24, 32, 38, 48, 64,
76px`.
- Dawn page gutters: fluid `20–72px`; max page width `1440px`.
- Dense page gutters: fluid `18–48px`; max reading width `1060px`.
- Content separators: 1px `--line`; major boundaries: 1px `--line-strong`.
- Control radius: 4–5px. Avoid fully rounded segmented controls and excessive
  pill shapes.
- Touch targets: 42px minimum for mobile controls; 44px for mobile links and
  category targets.
- Elevation: no default widget shadows. Status toast alone uses
  `0 14px 38px --shadow`.
- Dawn desktop structure: 12-column flow, weather spans 7 and birding spans 5.
  This proportion is a hierarchy, not a reusable equal-card grid.

## Patterns

- **One store, two renderers:** Dawn and Dense consume the same normalized
  widget envelopes. Neither fetches independently, changes source values, or
  reorders data. Switching renderer is instantaneous and preserves current
  state.
- **Independent appearance:** `system | light | dark` is orthogonal to
  `dawn | dense`. System follows device preference live. Save both per browser;
  never make display density imply palette.
- **Editorial masthead:** Dawn opens with date, personal greeting, useful daily
  synthesis, and real daylight context. The greeting is the visual anchor; the
  synthesis must be derived from visible data rather than decorative copy.
- **Daylight arc:** A responsive SVG traces sunrise-to-sunset progress. Always
  pair it with textual sunrise, sunset, and daylight duration. The SVG is
  supplementary and does not carry meaning alone.
- **Story region:** A major source uses open space, one heading, and internal
  rules. Avoid nesting multiple rounded cards. The largest or most actionable
  reading leads; metadata stays near the value it qualifies.
- **Dense scan row:** One small uppercase label rail plus a wrapping content
  region, separated by a hairline. On phone, remove the rail and stack label
  above content. Dense removes decoration, not data or status.
- **Location provenance:** Place and source appear together: `Current device`,
  `Last known · <age>`, or `Home`. Exact coordinates never appear. A failed
  current request can retain last-known/home data with explicit provenance.
- **Closest-first target list:** Deduplicate by canonical species before sort.
  For Lifers, Photo, and Audio, put known numeric distance ascending; equal
  distances use most recent observation first; unknown distances sort after all
  known distances. Apply the category limit only after sorting. Show distance
  in every row when available and print `closest first` beside target context.
- **Target category tabs:** Lifers, Photo, and Audio use text tabs on a shared
  baseline. Selected state is green text plus a 2px underline and
  `aria-pressed=true`; no pill background.
- **Month comparison:** Current partial period, current distinct-species count,
  prior-year equivalent-period count, and signed delta stay together. Always
  state the current date span; never compare a partial month to a complete one.
- **Quota comparison:** Keep provider identity, 5-hour and weekly labels,
  supplied remaining percentages, and reset times aligned. Meter width copies
  the supplied remaining percentage. Never infer a missing value or relabel one
  window as another.
- **Bookmark columns:** Preserve host configuration order inside named groups.
  Use baseline rhythm and rules, not tiles. Dawn may add a quiet outbound arrow;
  Dense remains plain text.
- **Fresh state:** Small named state plus source time. A dot may reinforce it,
  but the word/time carries meaning.
- **Loading state:** Static tinted line placeholders and source-specific copy.
  No shimmer is required. Sources load independently.
- **Stale state:** Keep last-good values visible and add an age, reason, and
  state word on a ruled note. Do not dim the entire widget until unreadable.
- **Partial state:** Retain every valid provider/subsection, mark the missing
  field, and name the affected source. Never hide valid sibling data.
- **Error state:** Replace only the failed source with a plain display-face
  heading, useful explanation, and underlined retry action. Never turn a
  source error into a page-level failure.
- **Status toast:** Fixed bottom-right on wide screens, bounded to the viewport,
  raised surface with a 3px gold left rule. It is an `aria-live` echo for
  preference and refresh results, not the only carrier of essential status.
- **Preference toolbar:** Compact square-cornered segmented groups, selected by
  inset bottom rule. Sticky where space permits and static on phone so it does
  not consume persistent vertical room.
- **Focus:** 2px `--gold-bright` outline with 3px offset on every interactive
  element. Hover never substitutes for keyboard focus.
- **Motion:** Segment and action feedback `160ms ease`; target and bookmark
  feedback `150ms ease`; toast transform/opacity `180ms ease`; data-path
  interpolation `220ms ease`; busy rotation `280ms linear`. Mode and theme
  apply immediately. Reduced motion forces `0.01ms`, one iteration. No motion
  longer than 300ms, except non-animated state dwell timers.
- **Responsive acceptance:** At 360, 680, 900, and 1440 CSS pixels verify no
  document overflow, the same values and states in both modes, 42–44px mobile
  targets, wrapped long place names, and a bounded forecast scroller.
- **Future widget placement:** Choose placement from information priority,
  freshness, and relationship to existing sources. Every new widget must define
  both a Dawn story treatment and Dense scan treatment before shipping. Do not
  append a default equal-weight card.

## References

- `design/Main.dc.html` — founding Dawn editorial-rich artboard.
- `design/DenseDark.dc.html` — founding Dense dark artboard.
- `design/DenseLight.dc.html` — founding Dense light artboard.
- `design/design-notes.md` — corrected chart, partial-period, touch-target, and
  content-integrity notes.
- `design/canvas.json` — original artboard relationship and direction record.
- `design/browser-start-page.html` — self-contained published visual brief.
- `pipeline/homedash-v1/design.html` — approved responsive interactive
  prototype incorporating independent appearance, failure states, and
  closest-first targets.

The `.dc.html` files are visual references, not implementation code. Do not copy
their fixed artboard sizes, external `support.js` dependency, or fixed content
height.

## Rationale

Homedash is opened repeatedly across phone and desktop, so instant orientation
and honest source status matter more than decorative novelty. Dawn provides the
calm, human-scale morning ritual that a default start page lacks; Dense supports
the same task when maximum scan speed is preferred. Keeping appearance separate
lets each device and environment choose comfortable contrast without changing
information density.

The visual system uses editorial scale and rules because four unrelated sources
need hierarchy, not four equal rectangles. Tinted neutrals and one daylight
accent make the page distinctive without competing with birding and provider
identity. Closest-first eBird ordering turns live observations into an
actionable outing list; distance is more useful than a hand-curated rarity
order, while recency remains the sensible tie-breaker. Explicit states protect
trust when Pi-hosted or remote sources are slow, stale, or partly unavailable.
