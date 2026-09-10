# Design Spec — Tide and Daylight Graphic

## Visual Direction
Extend Homedash's established warm editorial system with one coastal-day instrument inside the existing daylight position. The sun arc remains the upper visual anchor; a quieter tide curve shares its full-day horizontal scale below, with gold reserved for the current moment and next actionable turn.

## Screens / Views

### Dawn
The right side of the Dawn masthead becomes `CoastalDay`, replacing only the existing `SunArc` presentation while preserving the masthead grid. One SVG uses a midnight-to-midnight x-axis: a faint daylight band and sun arc occupy the upper field, the tide prediction curve occupies the lower field, sunrise/sunset rules cross both, and a gold now rule connects the two time systems.

Immediately below the graphic, a compact facts line reads `2.1 ft observed · rising`, `High 5.4 ft · 10:42 AM`, and `Alameda · MLLW`. The existing moon line remains separate and explicitly labeled `Moon · Waxing gibbous`; it is context, not a causal tide claim. Tide freshness or a partial-state note sits in a fixed-height source-local line so it never moves the masthead.

When tide is loading or unavailable, the solar arc and moon remain in the same position. The lower plot becomes a quiet ruled placeholder or an unavailable sentence with a tide-only retry, while weather/daylight never disappears. When weather is unavailable, the tide curve and its text remain, without invented sunrise/sunset markers.

At 680 CSS pixels and below, the same SVG compresses into the existing right masthead column. The visible facts collapse to `2.1 ft ↑ · high 10:42`, while the full observed/predicted, station, datum, next-turn, and freshness text moves into the top of the weather story. This preserves the 360×800 no-document-scroll budget without removing meaning.

### Dense
The Weather scan row gains a second compact line after the existing solar/moon line. It reads `tide · 2.1 ft observed · rising · high 5.4 ft 10:42 · Alameda · MLLW`, followed by the source-freshness language already used elsewhere.

A 120×18 inline SVG sits at the end of the line when space permits. It draws the same normalized prediction series with a gold current point and next-turn tick. At narrow widths it wraps below the text; it never replaces or truncates the facts.

### Loading, partial, stale, and error
- Loading: retain solar and moon output; show a static low-contrast tide line placeholder and `Reading the local tide…`.
- Partial: draw predictions, label the current value `predicted`, and state that an observation was unavailable.
- Stale: retain the last-good curve and facts with age plus `Refresh failed`.
- Error without last-good data: show `Tide is unavailable.` and one underlined tide-only retry; no other source changes.

## Component Usage
- Extend the existing native `DawnDaylight` and `DenseDaylight` composition through a focused `CoastalDay`/`TideTrace` component; do not add a card, dialog, tab, or new component library dependency.
- Reuse `SourceFreshness`, `LoadingState`, and `ErrorState` semantics in a compact tide-specific presentation.
- Use SVG paths and semantic HTML generated from the shared tide envelope. The SVG is supplementary and hidden from assistive technology; adjacent text carries the accessible summary.

## Design Tokens Applied
- `--gold` draws daylight progress and the now rule.
- `--gold-bright` marks the current tide point and next turn.
- `--line` draws the prediction track, daylight band edge, and inactive markers.
- `--line-strong` draws the tide zero/reference rule and sunrise/sunset rules.
- `--ink`, `--ink-soft`, and `--ink-faint` preserve the existing value/metadata hierarchy.
- `--gold-wash` fills the daylight interval at low opacity; no new color token is introduced.
- Existing display/body/mono families, 4–5 pixel control radius, and source-state copy remain unchanged.

## Interaction Notes
- The graphic is read-only. Hover may expose the nearest predicted time/height for pointer users, but all required facts remain persistently visible and no hover interaction is required to understand the tide.
- Global refresh includes tide and advances the existing progress indicator to five total sources.
- A tide error's retry requests only tide. It does not restart weather, daylight, moon, or other widgets.
- Dawn and Dense receive the same normalized points, current value, direction, and next turn; only composition changes.
- Time and height scales clamp validated values inside the SVG. A constant range receives symmetric padding so the line remains visible.

## Motion Spec
- Updated current/next markers: `ease`, 220ms, marker center, reduced motion `0.01ms`, CSS transition.
- Tide path interpolation after validated refresh: `ease`, 220ms, left-to-right time axis, reduced motion replaces instantly, CSS/SVG transition.
- Loading/error state replacement: `ease-out`, 160ms opacity only, source region, reduced motion `0.01ms`, CSS transition.
- No motion on first paint, no pulsing tide point, no wave animation, and no decorative looping.

## Content Notes
- Use feet with one decimal place and local times in the existing user locale.
- Use `observed` and `predicted` exactly; never call a predicted interpolation a reading.
- Direction is `rising`, `falling`, or `near slack`; arrows may reinforce rising/falling but never replace the words.
- Identify the next event as `High` or `Low`, followed by height and time.
- Show the configured station label and `MLLW` datum for provenance, never the station ID or coordinates.
- Keep moon language independent: `Moon · Waxing gibbous`, not `tide driven by…` or any precision claim.

## Responsive Acceptance
- At 1440×900, Dawn's combined instrument fits the existing masthead height and leaves the lede clear; Dense retains every source row without document scrolling.
- At 360×800, the compressed masthead graphic and relocated full tide facts remain inside their assigned regions with no clipped labels or horizontal overflow.
- Light and dark appearances retain curve/marker contrast, and all state text remains legible without relying on color.
