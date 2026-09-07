# Design Notes — read before porting the mockups

The artboards are a **visual spec, not a reference implementation.** They are
fixed-size Design Component frames that were never rendered in a browser; a
review caught real defects and the ones that could be fixed in a mockup have
been. What follows is the state of play.

## Fixed in the spec — do not reintroduce

- **The eBird sparkline no longer claims a zero baseline.** It was an area chart
  closing to the bottom of its box, which made the May peak work out to ~221
  species in one month against a 284-species year list from 197 checklists. It
  is now a plain line with no implied baseline.
- **The current month is marked partial.** September is 7 days old; its segment
  is dashed and its end dot hollow, labelled "SEP · 7 DAYS". It previously read
  as a settled value beating two complete months.
- **The headroom line names both windows.** "Codex has the 5-hour room · Claude
  the weekly" replaces "Codex has the headroom this window", which was true on
  the 5-hour horizon and false on the weekly one (Codex 63% wk vs Claude 41%).
- **Layout.** The rich-mode card row sizes to its content instead of a hard
  380px, so the bookmarks block no longer overruns the frame and eats the bottom
  padding; the weather card distributes its slack so the row has a level bottom
  edge; the 1px rules are `flex: none` so they can't collapse before the text
  does; bookmark monogram tiles are `aria-hidden` so screen readers stop saying
  "Gm Gmail".

## Still open — these are build concerns, not mockup concerns

1. **"Notable nearby" must come from eBird's notable/rare-bird endpoint for the
   region.** The mockup's list was hand-picked and it showed — Red-necked
   Phalarope, expected in the thousands at Alviso in September, was on it as a
   rarity. It has been removed, but a curated list will drift the same way
   again. Baird's Sandpiper at Hayward Regional Shoreline and American Redstart
   in Golden Gate Park are correct for the first week of September.
2. **Partial-period marking has to be real logic**, not a hardcoded dash. Any
   in-progress month, week, or window needs to render as in-progress.
3. **The headroom cue needs real logic across both windows** and their
   time-to-reset, not a static string.
4. **Text mode's 24px link rows are below a comfortable touch target.** That is
   inherent to the direction and deliberate at desktop width. If a phone ends up
   on text mode, the rows want to grow at narrow widths.
5. **Both modes are fixed-size artboards.** The real page is fluid; don't copy
   pixel heights. Rich mode is drawn at 1440×900, text mode at 820×620.

## Open design decision — the one thing left to pick

Text mode is drawn twice, dark and light, identical markup and two palettes.

- **Dark** keeps density as the only thing the switcher changes, leaving
  light/dark a separate axis you can apply to either mode later.
- **Light** makes text mode the day page to rich mode's night page — better in a
  bright room, but it welds ground colour to density, so choosing text mode also
  means choosing light.

This decides whether the build carries one theme axis or two. Pick before Stage
1 settles the mode-switching model.

## Checked and sound
Weather figures are internally consistent for San Francisco in early September
(58° now, H 72 at 2PM, L 56, sunrise/sunset within ~3 min of true, day length
correct; Sept 7 2026 is genuinely a Monday). llmdash percentages and reset
countdowns are mutually coherent. Every shared figure agrees across all
artboards. HTML is tag-balanced, every `oklch()` is valid and in sRGB gamut, and
the sun-arc marker geometry is exact rather than eyeballed.

## Reminder
Every number in every artboard is sample data. The San Francisco location was
inferred from this machine's timezone, not stated by you — confirm it.
