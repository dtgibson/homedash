# Design Refinement — Mobile Bookmark Visibility and Favicons

## Visual Direction

Keep Homedash’s warm editorial Dawn and ruled mono Dense identities intact. The bookmark treatment becomes a deliberate mobile action shelf inside the existing bookmark source region: wider, rhythmically separated, and visually quiet enough to remain subordinate to the day’s context while no longer feeling like five tiny text links squeezed into an evenly divided utility rail.

## Screens / Views

### Dawn, mobile

At 680px and below, keep Coding runway and Places to go beside one another, but move from the current near-even split to an asymmetric 35/65 rail. Coding runway retains every provider, percentage, meter, and reset in its narrower factual column; Places to go gains enough width for three legible group columns and substantially wider targets. The bookmark source keeps its fixed normal-payload budget and bottom safe-area padding where present.

Each bookmark is a single 60px-or-wider by 48px-or-taller native anchor at 360px, up from the current roughly 51×48 geometry. The 20px mark sits beside a wrapping name in the Dawn body face. Hairline separators and open ground keep the treatment a ruled action shelf, not a row of cards. More than five bookmarks remain in the existing bookmark-owned scroller; normal five-item content does not scroll.

The transient status notice moves from bottom-right to the upper-right edge below the mobile toolbar. It may briefly cover non-interactive masthead atmosphere, but never a bookmark, search field, setting, retry, launch, or target control.

### Dense, mobile

Dense keeps its scan-table structure and uses its already-full-width Bookmarks row as a five-column shelf. Each link is at least 60×58px with the mark above its centered mono label; compact visual group headings collapse while the existing labelled `nav` regions preserve group semantics. Host order, safe-area clearance, and bookmark-owned exceptional overflow remain unchanged.

### Desktop

Desktop Dawn and Dense retain their current columns, spacing, source order, and target density. The status notice remains bottom-right. The only visible favicon refinement shared with desktop is the new bookmark-specific fallback and any additional safely resolved icon.

### Icon states

The fixed 20px mark first renders a two-letter bookmark monogram derived from its visible name, such as `GM`, `CA`, `GH`, `EB`, or `ML`. It uses existing surface, line, and ink tokens and remains decorative. A valid remote favicon replaces those pixels immediately in the same slot; an error returns to the monogram without motion or layout change. The monogram is a designed fallback, not a claim that a favicon loaded.

## Component Usage

- Keep `BookmarkGroups` as the single ordered renderer for Dawn and Dense and keep each destination as one native anchor.
- Extend `BookmarkFavicon` with a visible-name input and a deterministic two-character fallback; do not add a button, popover, tooltip, or icon-status text.
- Use existing HTML navigation, status line, source freshness, and utility/dense row components. No new component library or dependency is needed.
- Preserve the exact bookmark accessible name. Both remote image and monogram wrapper remain `aria-hidden`.

## Design Tokens Applied

- Color: existing `--ground`, `--surface`, `--ink`, `--ink-faint`, `--line`, `--line-strong`, `--gold-bright`, and `--shadow` only.
- Type: Dawn link labels use `--body`; Dense labels and fallback monograms use `--mono`. Existing display headings remain unchanged.
- Dawn mobile rail: 35/65 source split, three equal bookmark group tracks with 5px gaps, at least 60×48px targets at 360px, a 20px mark, 5px mark-to-label gap, and a 1px bottom rule.
- Dense mobile shelf: five equal tracks, 4px gaps, at least 60×58px targets at 360px, a 20px mark, and a 7px vertical mark-to-label gap.
- Desktop mark: retain the current 18px slot and existing link geometry.
- Focus: retain the 2px bright-gold outline and 3px offset, with at least 5px internal scroller clearance.
- Safe area: mobile bookmark padding includes `env(safe-area-inset-bottom, 0px)` without changing the 360×800 zero-inset fixture.

## Interaction Notes

- Tapping the mark, label, or surrounding shelf cell activates the same native same-tab anchor.
- A mode or appearance change preserves bookmark data, link order, favicon URL, fallback monogram, focus semantics, and navigation.
- The browser continues to request only the existing same-origin favicon route. Broader server retrieval must remain bounded and cannot alter bookmark readiness or source freshness.
- At 360×800, both modes show all five links at least 60px wide with no document, horizontal, or bookmark-region scrolling; the status notice cannot intersect any interactive rectangle.
- At 360×650 or with more than five bookmarks, only the bookmark region may scroll vertically. Horizontal scrolling is never introduced.

## Motion Spec

- Bookmark hover/focus feedback: `ease`, 150ms, anchor center, reduced motion at 0.01ms, CSS.
- Remote favicon to monogram swap: immediate, 0ms, fixed mark slot, unchanged for reduced motion, React + CSS.
- Status notice enter: `ease-out`, 180ms, upper-right edge on mobile / lower-right edge on desktop, reduced motion at 0.01ms, CSS.
- Dawn/Dense and appearance switching: immediate, 0ms, whole renderer, unchanged for reduced motion, React state + CSS variables.

## Content Notes

Keep `Places to go`, `Bookmarks`, all host-provided group names and bookmark names, and existing freshness language. Do not abbreviate configured names, replace names with icon-only controls, or add icon-state copy. The fallback characters are derived presentation, excluded from the accessibility tree, and never replace the visible name.

## Responsive and State Proof

The implementation must prove Dawn and Dense across System, Light, and Dark at 360×800 and 1440×900, plus a short 360×650 overflow case. Tests must measure minimum target geometry, target separation, document and source-region overflow, viewport containment, focus clearance, and status-notice intersection. Mixed remote success, remote failure, malformed ID, mode switch, and long-label cases retain identical link semantics and fixed mark geometry.
