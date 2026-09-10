# Design Spec — eBird Distance and Sort Preference

## Visual Direction

Extend the established warm editorial dashboard with a second, deliberately quieter decision axis inside Birding pulse. Target category remains green eBird identity; target order uses the existing gold preference language so the two control groups are visually and semantically distinct without adding a card, popover, icon, or color.

## Screens / Views

### Dawn

Keep the existing heading, freshness line, month comparison, category tabs, and five-row target region. Replace the static `closest first` suffix with a single compact context rail: `Top nearby targets · within 10 mi` on the left and an `Order` group with `Nearest` and `Recent` on the right.

The selected order is gold text with a 2px inset bottom rule; the unselected order is faint ink. The existing Lifers/Photo/Audio group stays immediately below and keeps its green selected state. This establishes a clear hierarchy: target context and ordering first, category second, ordered destinations third.

At 680 CSS pixels and below, the context and order remain on one flex row when they fit, with the context allowed to truncate before either control does. Each order option becomes at least 44×44 CSS pixels. The Birding story retains its existing bounded overflow rather than increasing document height.

### Dense

Keep the eBird scan row and its label rail. Place the same `Nearest`/`Recent` order group at the end of the existing summary line beside `within 10 mi`, followed by the unchanged category baseline and compact target rows.

On narrow screens the Dense label rail collapses as it does today; the target context occupies the left of its line and the order group stays right-aligned with 44px touch targets. Ordered rows retain name, locality, distance, time, and constrained map link.

### Saved, loading, stale, and unavailable states

The selected order is a browser preference, not source freshness. A saved ready/stale eBird envelope supports either order immediately. The control is absent when no valid eBird envelope exists, matching the current category controls; eBird loading and unavailable states remain unchanged. If preference storage fails, the visual selection and list still update for the visit while the existing status toast announces that it could not be retained.

## Component Usage

- Extend the existing `TargetTabs` family with a focused Radix UI single-selection `TargetOrder` group; do not merge category and order into one group.
- Reuse the existing target list and row links without new icons or containers.
- Pass the selected normalized projection into `TargetList`; renderers do not sort.
- Reuse the existing status toast for successful and storage-failed preference announcements.

## Design Tokens Applied

- `--gold-bright` marks the selected target order and its inset underline because order is a device preference.
- `--green` remains exclusive to eBird identity, the selected target category, month delta, and source confirmation.
- `--ink-faint` carries the `Order` label and unselected options; `--ink` and `--ink-soft` keep target hierarchy unchanged.
- `--line` and `--line-strong` retain all baselines and source boundaries. No new token, radius, shadow, or filled segmented-control treatment is introduced.
- Existing display/body/mono roles remain unchanged; the order label and options use the mono label role.

## Interaction Notes

- `Nearest` and `Recent` form one named, keyboard-operable single-selection group with a persistent visible label and programmatic pressed state.
- Selection updates both renderers' shared preference and target projection synchronously, retains the current category and focus, and makes no request.
- Switching Dawn/Dense or System/Light/Dark retains order. Reload restores the saved choice; legacy or invalid choice defaults only the order to Nearest.
- Announcement copy is `Nearest targets selected.` or `Recent targets selected.`; storage refusal appends `This browser could not retain the choice.`
- Full labels are always visible; no icon, tooltip, hover-only explanation, or color-only status carries meaning.

## Motion Spec

- Order selected rule/color: `ease`, 160ms, active option baseline, reduced motion `0.01ms`, CSS transition.
- Target row replacement: immediate DOM/state reorder with no entrance, stagger, translation, or opacity effect; reduced motion is identical, React/CSS.
- Existing target hover/focus feedback: `ease`, 150ms, text underline, reduced motion `0.01ms`, CSS transition.
- Existing status toast: `ease`, 180ms, bottom-right edge, reduced motion `0.01ms`, CSS transition.

## Content Notes

- Use `Order` as the compact persistent group label and `Nearest` / `Recent` as the two choices.
- Use `Top nearby targets · within 10 mi` in Dawn and `within 10 mi` in Dense.
- Announcements say `targets selected`, avoiding an implication that a new eBird fetch occurred.
- Keep distance and observation age visible in every row so users can understand either order rather than trusting the selected label alone.
