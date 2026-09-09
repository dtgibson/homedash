# Design Spec — Moon Phase Near Sunrise and Sunset

> Implementation reference for the approved Feature design. The interactive,
> self-contained state model is `design.html` in this directory.

## Visual Direction

Extend homedash's established daylight language with one quiet, familiar lunar
fact. Dawn keeps its warm editorial sun-arc treatment; Dense keeps its compact
mono scan. In both renderers, the exact canonical phase name is the meaning and
is subordinate to current conditions, sunrise, and sunset. No canonical design
token, pattern, or component changes are required.

## Screens / Views

### Dawn

At 1440×900, retain the existing masthead split: greeting and daily synthesis
on the left, the daylight composition on the right. The phase sits inside that
existing right-hand composition, immediately below the textual `Sunrise 6:47 ·
12h 46m daylight · Sunset 19:33` line and centered on the same axis as the sun
arc. It is one compact mono phrase: `Moon · Waxing gibbous`, where the phase
name is the canonical shared value.

The phase is not part of the weather freshness line, Open-Meteo attribution,
location provenance, SVG accessible name, or weather value body. The daylight
composition owns a stable phase slot outside the conditional solar values. If
weather has no usable value, the arc and sunrise/sunset/daylight values omit as
they do today while `Moon · <canonical label>` remains in that same masthead
context. It receives no loading, stale, error, source, or retry treatment.

At 360×800, the masthead remains a two-column composition. The right column is
128px wide; the arc uses 27px of height, the three solar labels remain on their
existing line, and the phase follows on a 6px mono line. The masthead becomes
60px tall, borrowing only from the flexible birding region rather than adding
document height. All existing toolbar, weather, birding, quota, bookmark, Kagi,
launch-link, and refresh geometry remains otherwise unchanged.

### Dense

At 1440×900, retain exactly four ruled source rows. The weather row's existing
second scan line continues with hourly values followed by its solar summary;
the shared phase is appended to that same daylight context as `moon · Waxing
gibbous`. It is `--ink-soft`, one step stronger than surrounding faint solar
metadata but quieter than the temperature and condition.

At 360×800, the five hourly values keep their five-column strip. The solar and
lunar copy share the full-width line beneath it and wrap only between semantic
phrases. The phase name itself may wrap at a word boundary for text zoom but is
never ellipsized or clipped. No fifth row, label rail, status line, badge, or
control is introduced.

When weather is first-loading or unavailable without a saved value, weather
values and the solar fragments omit while the phase remains in the established
weather/daylight line. When a cached or last-good weather value exists, all
solar values remain visible and the phase stays current independently. The
weather row alone retains its existing `aria-busy`, error, provenance, and retry
behavior; the phase never acquires those semantics.

### Phase variants and invalid-time omission

Both renderers consume the same nullable shared value and render exactly one of:

- `New moon`
- `Waxing crescent`
- `First quarter`
- `Waxing gibbous`
- `Full moon`
- `Waning gibbous`
- `Last quarter`
- `Waning crescent`

The visible phrase is `Moon · <canonical label>` in Dawn and lowercase-prefix
`moon · <canonical label>` in Dense. Capitalization of the canonical value is
not altered. No illumination, age, percentage, boundary time, moonrise,
moonset, visibility, forecast, or astronomical-precision copy appears.

For a `null` result, omit the prefix, label, and any supplementary mark as one
unit. Do not render `Unknown`, reserve visible blank punctuation, announce a
failure, or retain the previous phase.

## Component Usage

- `App` owns one `MoonPhaseLabel | null` above the presentation fork and passes
  that exact value to both view renderers. Renderer and appearance changes do
  not re-derive or relabel it.
- `SunArc` (or a minimal adjacent `DaylightPhase` presentational fragment) keeps
  the SVG and solar accessible name unchanged, then renders the visible phase
  as a sibling in the same daylight composition. The phase is not inserted
  into the SVG or its `aria-label`.
- `DenseWeather` may separate its existing solar summary from conditional
  weather values so the parent weather row can render the shared phase even
  without a `WeatherEnvelope`. This is a presentation refactor, not another
  row, state, or data source.
- Any optional lunar glyph is purely supplementary, derived from the canonical
  label, adjacent to the text, and `aria-hidden="true"`. The approved prototype
  intentionally uses no glyph because the text is clearer and more stable
  across platforms.
- The prototype's Review menu is an audit affordance only. Its phase, weather,
  mode, and appearance controls must not ship.
- Existing `SourceFreshness`, `LoadingState`, `ErrorState`, `Toolbar`, Kagi
  form, launch anchors, target tabs, source retry buttons, forecast, and source
  bodies keep their present roles and behavior.

## Design Tokens Applied

No canonical design-system changes are needed.

- Background, atmosphere, and solar arc retain `--ground`, `--ground-deep`,
  `--gold-wash`, `--green-wash`, `--line`, `--line-strong`, and `--gold`.
- Phase prefixes use `--ink-faint`; canonical labels use `--ink-soft`. The
  phase is never green (source success), danger (failure), or gold (primary
  daylight/action emphasis).
- Dawn keeps `--display` for editorial readings, `--body` for prose, and
  `--mono` for daylight metadata and phase copy. Dense remains mono-led.
- Existing 4–5px control radii, hairline rules, gold focus outline, target
  sizing, and unboxed story/source geometry remain unchanged.

## Interaction Notes

- The phase has no interaction, tooltip, disclosure, source badge, setting,
  refresh affordance, or focus target.
- Re-evaluating to a different canonical phase replaces text immediately in
  place. If the value is unchanged, preserve the same DOM/state identity.
- A valid result remains visible through weather ready, cached-refreshing,
  refresh-failed-with-last-good, first-load, and unavailable-without-value
  states. A weather refresh does not style the phase as busy or stale.
- An invalid phase result removes all lunar output without moving focus or
  changing weather, solar, source-count, or retry state.
- Switching Dawn/Dense or System/Light/Dark changes presentation only. The
  canonical label and assistive meaning remain equivalent.
- Logical reading order in Dawn is date, greeting, synthesis, the existing
  sunrise/sunset/daylight accessible context, then visible phase text, followed
  by the source stories. Dense reads weather label, freshness when present,
  current values, hourly values, sunrise/sunset/daylight, then phase, followed
  by the unchanged eBird, llmdash, and bookmarks rows.

## Responsive, Wrapping, and Zoom Acceptance

- At 1440×900 and 360×800 CSS pixels, the normal five-target/five-bookmark
  fixture has no horizontal or vertical document overflow and no source-region
  overflow. Existing source-owned overflow remains the only fallback for
  genuinely oversized payloads or shorter unsupported heights.
- Dawn's phase uses normal flow, a centered flex line, `min-width: 0`, and
  word-boundary wrapping. Dense's daylight line uses wrapping flex. Neither
  renderer applies ellipsis, line clamp, `white-space: nowrap`, fixed-width text
  clipping, or absolute positioning to the canonical label.
- The longest approved labels (`Waxing crescent`, `Waxing gibbous`, `Waning
  gibbous`, and `Waning crescent`) fit at both release viewports. Solar values
  may wrap as semantic units before the phase label, but the canonical phase
  itself remains complete.
- At 200% text zoom, the phase remains in normal logical order and may wrap to
  an additional line inside the existing bounded daylight/weather region. It
  must not overlap the arc, toolbar, source status, or adjacent values. No
  essential phase text may be clipped or replaced by punctuation-only copy.
- System resolving light and System resolving dark must match explicit Light
  and Dark contrast behavior. Phase text meets WCAG 2.2 AA against the tinted
  ground in both palettes.

## Accessibility

- The canonical visible text is the accessible name/meaning; do not replace it
  with an icon-only name, tooltip, CSS-generated content, or an SVG label.
- `Moon` provides plain-language context. The eight canonical labels remain
  text nodes in the DOM and are not hidden from assistive technology.
- Any future supplementary glyph duplicates no unique information and must be
  `aria-hidden="true"`.
- The phase is not a live region. Ordinary lifecycle re-evaluation is quiet;
  it does not add minute-by-minute announcements.
- Meaning never depends on color, shape, placement, animation, or weather
  source state. Light and dark contrast, keyboard focus on neighboring
  controls, mode `aria-hidden` behavior, and 44px mobile interaction targets
  remain intact.

## Motion Spec

- Phase appearance, change, and omission: immediate text update, `0ms`, own
  inline baseline, identical under reduced motion, no library.
- Dawn/Dense mode and System/Light/Dark appearance changes: existing immediate
  renderer/palette swap, `0ms`, viewport, identical under reduced motion,
  existing React/CSS.
- Existing source refresh glyph, source-value replacement, toolbar feedback,
  target/bookmark feedback, and status-toast transitions remain exactly as
  documented in `pipeline/design-system.md`; the phase does not join them.
- Prototype Review menu: existing `cubic-bezier(.16, 1, .3, 1)`, `180ms`,
  top-right trigger, immediate under reduced motion, CSS. This control does not
  ship.

## Content Notes

- Use only `Moon · <canonical label>` / `moon · <canonical label>`.
- Do not say `today's moon`, `visible tonight`, `Open-Meteo moon`, `local moon`,
  `live`, or `updated`; each would imply unsupported date, visibility,
  provenance, location, source, or freshness semantics.
- Keep weather provenance and Open-Meteo attribution unchanged and adjacent
  only to weather values. The local deterministic calculation adds no source
  attribution of its own.
- The design artifact uses realistic sample values solely to show layout and
  state geometry. It contains no private host, credential, coordinate, or
  production bookmark.

## Implementation Acceptance

- One controlled shared result produces identical canonical text in Dawn and
  Dense for all eight labels and all three appearance choices.
- `null` produces no `Moon`, `moon`, phase label, punctuation, hidden stale
  value, or supplementary glyph in either renderer.
- The phase remains present and unchanged in ready, cached-refreshing,
  failed-with-saved, first-load, and unavailable weather states, while weather
  state and four-source progress behavior remain unchanged.
- Dawn positions the phase within the existing daylight masthead treatment;
  Dense positions it in the existing weather/daylight line. Neither adds a
  card, widget, source, ruled row, badge, control, or status treatment.
- Exact 1440×900 and 360×800 audits pass with all approved label lengths,
  omission, Dawn/Dense, Light/Dark/System-resolved palettes, and representative
  weather states; document and source regions have no overflow and essential
  content is not clipped.

