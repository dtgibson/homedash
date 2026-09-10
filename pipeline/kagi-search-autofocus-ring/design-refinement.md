# Design Refinement — Kagi Search Autofocus Ring

## Visual Direction
Keep the shared toolbar and compact search geometry unchanged. Replace the oversized offset outline with a contained, two-part focus signal: the form border warms to gold and a two-pixel inset rule appears along the input's lower edge, leaving the Kagi label and surrounding toolbar visually clear.

## Screens / Views

### Shared toolbar, desktop and tablet
The 36-pixel search form retains its current label, input, submit button, border, radius, and surface color. On initial focus, the existing form border changes to `--gold` and the input gains an inset bottom rule in `--gold-bright`; neither cue extends beyond the component.

### Shared toolbar, mobile
The same focus language applies to the existing 44-pixel-tall full-width form. The inset rule stays beneath only the editable input region, so it never crosses the Kagi label or submit-button divider.

### Appearance variants
The treatment uses the established light and dark token values with no one-off color. The brighter gold rule remains the precise keyboard-focus cue, while the form border and raised surface communicate the broader active state.

## Component Usage
Use the existing native search form, label, search input, and submit button. No new Radix component or dependency is needed; this is a state refinement of the shipped shared action chrome.

## Design Tokens Applied
- `--line-strong` remains the resting border.
- `--gold` marks the active form border.
- `--gold-bright` draws the two-pixel inset focus rule.
- `--surface` replaces the translucent resting fill while the form contains focus.
- Existing 4-pixel radius and 36/44-pixel desktop/mobile heights remain unchanged.

## Interaction Notes
- Preserve the existing focus-once behavior on initial mount with `preventScroll`; do not reclaim focus after the user moves elsewhere.
- Override only the Kagi input's global offset outline. Use an inset lower-edge rule so focus remains visible without painting over the label or neighboring controls.
- Keep `:focus-within` on the form for a subtle active border and surface change whether focus arrived programmatically, by keyboard, or by pointer.
- When focus leaves the form, both cues return to their resting values.
- Leave all other interactive elements on the global focus treatment.

## Motion Spec
- Form active state: `ease`, 160ms, component bounds, reduced motion `0.01ms`, CSS transitions.
- Input focus rule: `ease`, 160ms, lower input edge, reduced motion `0.01ms`, CSS transitions.

## Content Notes
No labels, placeholder text, validation copy, or search behavior change. Kagi remains the visible source name and “Search the web” remains the prompt.

## Acceptance Notes
- Initial page load places focus in the Kagi query exactly once.
- No focus paint extends outside the search form or crosses the Kagi label.
- The input remains visibly focused in light and dark appearances at desktop and mobile sizes.
- Switching views or opening Settings does not cause the search field to reclaim focus.
