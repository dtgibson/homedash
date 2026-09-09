# Design Refinement — Instant Cached Data Refresh

> Implementation reference for a targeted Improve pass. The interactive, self-contained state model is `design.html` in this directory.

## Visual Direction

Keep the established homedash identity intact: Dawn remains a warm editorial morning note and Dense remains a restrained mono-led scan. The refinement changes only how each existing source tells the truth about age and background work. Cached values stay visually primary; a quiet ruled freshness line directly beneath each source heading carries last-updated time, refresh activity, and failure recovery without dimming, blanking, or moving the source content.

### What changes from today

- Today, a refresh replaces ready content with a loading treatment and only restores the last-good snapshot after failure. The refined state keeps a valid last-good reading rendered from the initial paint onward.
- Today, freshness is split across badges, age fragments, and issue notes. The refined state gives weather, eBird, llmdash, and bookmarks one consistent source-local sentence: `Updated <time>` plus an explicit state such as `Refreshing`, `Refresh failed`, or `Up to date`.
- Today, the global Refresh button communicates only an all-source busy state. The refined button reports aggregate progress (`Refreshing 2/4`) while each source independently settles in place.
- No new user-facing surface, route, source, flow, token, or component library is introduced. The prototype-only Review menu exists solely to inspect first-visit and failed-refresh geometry.

## Screens / Views

### Dawn

The existing 1440×900 three-region composition remains: weather is the focal reading, birding follows as the primary opportunity, and coding runway/bookmarks share the utility rail. Each section heading gains a fixed-height freshness line immediately below it. Its first phrase is the source age (`Updated 8:02 AM · 12 min ago`); the second is the current action or outcome (`Refreshing`, `Up to date`, or `Refresh failed · Try again`). A small outlined dot and rotating refresh glyph reinforce the text but never carry meaning alone.

At 360×800, the freshness line collapses to one compact mono line per source and uses short, full-meaning copy (`12m old · refreshing`). It consumes the space previously scattered across source badges and stale notes, so the approved weather, birding, utility, and bookmark bands remain within the one-screen budget. Long labels truncate only in decorative metadata; state words and retry actions never truncate.

Cached content is never visually dimmed. When a source settles, only that source's freshness line and the values that actually changed receive a 220ms in-place update; siblings remain untouched. eBird's slower match can continue saying `Refreshing` after weather, bookmarks, and llmdash already say `Updated just now`.

### Dense

Dense preserves its four ruled source rows and label rail. The same freshness sentence sits on the row's top baseline, right-aligned on desktop and stacked below the source label on phone. It uses identical terms and timestamps as Dawn because both views read the same envelope state. No additional card, badge column, or global status strip is introduced.

At 360×800, the existing row heights remain bounded. Freshness is one line tall, target and bookmark order does not change, and the normal five-target/five-bookmark payload stays visible. Dense removes decorative motion but retains the same busy glyph rotation and in-place value transition where it clarifies completion.

### Cached initial paint and independent automatic refresh

On a returning visit, every valid snapshot paints immediately. Each source line initially reads its own age and `Refreshing`; values, links, provenance, target order, quota meters, and bookmark order remain interactive. The source request that resolves first switches only its line to `Updated just now · Up to date` and replaces only its own valid values. There is no page-level loading state, content flash, or cross-source reflow.

### Manual refresh

The existing toolbar Refresh action remains the only global refresh control. While work is pending, its accessible label and visible desktop label report aggregate progress from zero through four. It is temporarily disabled to prevent duplicate batches, but source-local retry links remain available after failure. The polite global announcement says that cached values remain visible, then announces source completions and the final outcome without moving keyboard focus.

### First visit with no valid snapshot

Only a source without a valid snapshot uses the established static loading lines and source-specific copy. The other sources may already show cached or fresh values. The loading treatment occupies the same source region and has a source-scoped `role=status`; it does not trigger a page-level busy overlay or shimmer. Missing, malformed, and version-incompatible snapshots follow this path.

### Refresh failure with last-good data

When a refresh fails and a valid snapshot exists, the last-good values remain fully legible. The freshness line becomes `Updated <time> · Refresh failed` and exposes a source-scoped underlined `Try again` action. A concise reason may follow on the same ruled note where space allows. The source is not replaced by the existing empty error treatment, and unrelated sources are not relabeled.

If there is no valid snapshot, the existing source-local error heading, useful explanation, and retry action remain correct. This refinement does not mask an empty-source failure as cached data.

## Component Usage

- `WidgetState` should own one reusable `SourceFreshness` treatment so status vocabulary, timestamp formatting, retry semantics, `aria-live`, and fixed geometry stay identical across renderers.
- `DawnView` and `DenseView` place that treatment at each source heading boundary. They consume the same state and never calculate age or request status independently.
- `Toolbar` retains Radix Toggle Groups and its current Refresh action. The button adds determinate text and an accessible aggregate label; mobile may keep the glyph-only visual while preserving the full label for assistive technology.
- Existing `LoadingState` and `ErrorState` remain for sources without valid snapshots. Static loading lines, not shimmer, remain the pattern.
- `StateBadge` continues to serve provider/subsection health such as a partial llmdash provider. It should not duplicate the source-level freshness sentence.
- Existing forecast, target, quota, bookmark, launch, and preference components retain their markup, order, actions, and sizing.

## Design Tokens Applied

No canonical token changes are needed. Use the existing light/dark `--ground`, `--surface`, `--ink`, `--ink-soft`, `--ink-faint`, `--line`, `--line-strong`, `--gold`, `--green`, `--danger`, and provider identity colors. The freshness line uses mono metadata sizing, a 1px `--line` rule, `--ink-faint` for age, `--gold` for active refresh, `--green` for up-to-date confirmation, and `--danger` for failure with adjacent text.

Dawn continues to use Iowan Old Style/Palatino for display, Avenir Next/Segoe UI for body, and SF Mono/Menlo for labels and data. Dense remains mono-led. Controls keep 4–5px corners and the gold focus outline. The freshness treatment introduces no pill, elevation, translucent card, or new color.

## Interaction Notes

- Hydration and automatic refresh begin without moving focus or announcing four simultaneous starts. One polite summary announces `Showing saved readings while four sources refresh.`
- Each source completion updates only its own state and data. Use keyed/state-preserving content; do not remount the whole view or reset the selected eBird category.
- The source status text is always present in the DOM. Use `role=status` and `aria-live=polite` on a dedicated visually compact sentence, with `aria-atomic=true`; never rely on the rotating glyph or color.
- Announce meaningful transitions once: refresh start, each source completion/failure, and batch completion. Do not announce elapsed-age ticker changes every minute.
- The Refresh button's busy icon is `aria-hidden`; its visible label and `aria-label` carry progress. The button returns to `Refresh` after the batch settles.
- A failed source's `Try again` is a real button, remains keyboard reachable, and names its source (`Try weather again`) in its accessible label.
- Recomputing relative age must not change layout width. Reserve one freshness line and use tabular numerals. At narrow widths, prefer `12m old` over wrapping a longer phrase.
- Switching Dawn/Dense or appearance mid-refresh preserves the in-flight and cached states. The selected mode changes presentation, not the request lifecycle.
- Use `aria-busy=true` only on the individual source region that is refreshing. Do not set page-level `aria-busy` while readable cached values are present.
- Exact acceptance audit: for Dawn and Dense at 1440×900 and 360×800, and for cached-refreshing, independent-settle, failed-with-last-good, and first-visit-loading previews, assert `document.scrollWidth <= document.clientWidth`, `document.scrollHeight <= document.clientHeight`, and no source-region content overflow for the normal five-target/five-bookmark payload.

## Motion Spec

- Source refresh glyph: `linear`, 280ms per rotation, icon center, one 0.01ms iteration under reduced motion, CSS.
- Valid source value replacement: `ease`, 220ms, changed value's own baseline, immediate update with no opacity/transform under reduced motion, CSS.
- Source freshness state change: `cubic-bezier(.16, 1, .3, 1)`, 180ms, ruled line's left edge, immediate text/color change under reduced motion, CSS.
- Refresh button label/progress: `ease`, 160ms, control center, immediate text update under reduced motion, CSS.
- Status toast enter/exit: `cubic-bezier(.16, 1, .3, 1)`, 180ms, bottom-right edge, immediate opacity with no translate under reduced motion, CSS; 2600ms dwell is not animated.
- Prototype Review menu: `cubic-bezier(.16, 1, .3, 1)`, 180ms, top-right trigger, immediate opacity with no scale/translate under reduced motion, CSS. This menu is not part of production.

## Content Notes

- Use `Updated 8:02 AM · 12 min ago · Refreshing` in spacious Dawn/desktop contexts and `12m old · refreshing` where the viewport demands a compact form. Never say `Live` while cached data is awaiting confirmation.
- Successful current data reads `Updated just now · Up to date`; after the immediate moment it becomes a stable timestamp rather than a frequently announced timer.
- Failure copy names both trust facts: `Updated 8:02 AM · Refresh failed. Saved reading remains.` Retry copy names the affected source.
- First-visit copy stays source-specific: `Reading weather`, `Matching nearby sightings to your eBird history`, `Reading authoritative limits from llmdash`, and `Reading bookmark configuration`.
- The mockup uses plausible sample readings only. It does not imply they are the user's live readings.

## Accessibility and Responsive Acceptance

- State is conveyed by words, never color or motion alone; every icon is supplementary.
- Freshness and batch announcements are polite and atomic. Focus stays on the control the user invoked.
- Refresh, retry, appearance, mode, search, category, and bookmark controls retain visible focus and at least 44px targets at 360px.
- Both renderers retain the same weather values, eBird partial-period context and closest-first targets, llmdash windows/reset times, five bookmarks, and location provenance.
- The 1440×900 and 360×800 normal payloads fit one screen in all audited states. If actual content exceeds the bounded payload, existing source-region scrolling remains the fallback; document scrolling is not introduced.

## Implementation Boundary

This pass refines existing state treatments only. It does not change snapshot keys or schemas, add persisted fields, introduce a new source or request, alter location provenance, reorder targets/bookmarks, create a new screen, or modify the canonical design system. The prototype's Review control and simulated timings are design-audit affordances only and must not ship.
