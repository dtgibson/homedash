# Design Spec — Settings Window and Bookmark Management

## Visual Direction

Extend homedash's warm, editorial Dawn and mono-led Dense system with one
focused transient surface. The closed dashboard becomes quieter because the
persistent display and appearance groups collapse into one visibly labeled
Settings button; opening it reveals a raised, ruled work window that feels like
part of homedash rather than a generic administration console.

Gold remains the singular deliberate-action accent. It marks current
preferences, focus, and the primary Save action; bookmark structure, validation,
and secondary actions rely on typography, rules, and plain language rather than
new colors or stacked cards.

## Screens / Views

### Closed Dawn Dashboard

The shared 52px desktop toolbar retains the homedash wordmark, one Kagi search
form, Location, and Refresh. The previous Dawn/Dense and System/Light/Dark
groups are replaced by one neutral, visibly labeled **Settings** button with a
small settings glyph. It sits immediately before Location and Refresh, so
presentation preferences remain discoverable without outranking daily actions.

The dashboard below is unchanged: greeting and daylight context lead, followed
by the open weather/birding/utility composition. Settings does not become a
widget or consume story space. At 360px, Kagi occupies the first toolbar row and
Settings, Location, and Refresh occupy the second; each is at least 44px high.

### Settings Window — Desktop

A viewport-bounded modal overlays the real current dashboard. The background is
dimmed and visually softened but does not move; while open it is inert,
unavailable to pointer and assistive-technology interaction, and cannot scroll.
The 960px-wide window has three fixed regions:

- A compact header with the display-face title **Settings**, persistence-scope
  description, and visibly labeled Close control.
- One internally scrolling body. At desktop width, **This browser** is a 244px
  left rail and **Shared bookmarks** is the wider primary work area. A vertical
  rule separates the two; neither region is a nested card.
- A sticky action footer with staged-change status on the left and Cancel plus
  the gold Save bookmarks action on the right.

The **This browser** rail contains two customized segmented groups: Dawn/Dense
and System/Light/Dark. Its heading and `Only this browser` scope label are
followed by specific copy: changes apply immediately and do not join the shared
bookmark draft. Changing either preference updates the obscured dashboard
without closing or resetting the window.

The **Shared bookmarks** region leads with `Every tailnet device` and concise
copy that saved changes replace the shared ordered list. Sections are a flat
ruled sequence, not cards. Each section exposes a required name field, an
ordinal, explicit Move up/Move down buttons, and Remove. Bookmark rows are
indented by one rule and contain Name and URL fields plus the same explicit
ordering/removal controls. Add bookmark sits at the end of each section; Add
section sits after the sequence.

The representative draft uses three realistic sections in saved order:

1. **Daily** — Gmail, Calendar
2. **Projects** — GitHub
3. **Birding** — eBird, Macaulay Library

Disabled boundary arrows remain visible, making the ordering model legible.
The primary prototype journey supports editing fields, adding and removing
items, moving them one position, inline validation, dirty-state tracking,
discard confirmation, loading/read-error/conflict previews, and a confirmed
save that updates the dashboard bookmarks without reloading other sources.

### Settings Window — 360×800

At the release phone size the window becomes an edge-to-edge viewport modal,
not a narrow desktop dialog. Header and footer stay fixed; only the body between
them scrolls. **This browser** stacks above **Shared bookmarks**, separated by a
strong horizontal rule. Preference choices fill the available width.

Each section keeps a one-line identity/action header and stacks its bookmark
fields beneath it. All Settings, Close, preference, move, remove, add, retry,
Cancel, discard, and Save controls are at least 44×44 CSS pixels. URL values can
wrap within their fields; the window never creates horizontal or document-level
scroll. The overlay retains the dashboard's scroll position and restores focus
to the same Settings trigger after close or save.

### Bookmark Editor States

- **Loading:** This browser remains fully usable. Shared bookmarks shows static
  ruled placeholders and `Reading the latest saved bookmarks…`; mutation and
  Save are disabled.
- **Read failure:** Device controls remain usable. A plain ruled notice says
  `Saved bookmarks could not be opened` and offers Retry; it never shows a host
  path or internal detail.
- **Pristine:** Footer reads `Saved order · no bookmark changes`; Save is
  disabled. Preference changes do not change this status.
- **Dirty valid:** Footer reads `Bookmark changes are staged on this device`;
  Save becomes the one filled gold action.
- **Validation:** The error summary announces the count and instructs the owner
  to fix marked fields. Each affected input uses `aria-invalid`, a danger rule,
  and associated plain-language copy such as `Enter a name for this bookmark.`
  No request is implied.
- **Saving:** Editor mutations and all dismissal controls disable. Save reads
  `Saving…`; the footer says `Checking and replacing the shared bookmark list…`.
- **Conflict:** The full draft stays visible. A ruled status block says
  `Saved bookmarks changed elsewhere` and offers **Reload saved bookmarks** and
  **Keep this draft open**. There is no force-overwrite or merge control.
- **Dirty close:** An in-window confirmation, focused above the editor, names
  the consequence and offers exactly **Discard bookmark changes** and **Keep
  editing**. Outside click never closes the parent window.
- **Confirmed save:** The window closes, focus returns to Settings, the
  dashboard bookmark region alone accepts the confirmed order, and the shared
  status region announces `Bookmarks saved.`

## Component Usage

- Use the configured Radix primitives in the implementation: `Dialog` for the
  Settings window and discard/remove confirmations, `ToggleGroup` for device
  preferences, and accessible native form controls within the dialog. Customize
  all primitives with homedash tokens and its square-cornered, rule-led grammar.
- `Toolbar` owns one `Settings` trigger above the Dawn/Dense renderer fork. It
  continues to own Kagi, Location, and Refresh; no current dashboard action
  moves into Settings.
- `SettingsDialog` owns focus trapping, background inertness, scroll locking,
  fresh-document loading on every open, clean/dirty close routing, and the
  sticky header/footer frame.
- `BrowserPreferences` receives the existing controlled preference value and
  callback. It performs no bookmark request and is never part of bookmark dirty
  comparison.
- `BookmarkEditor` receives a separately keyed memory-only baseline/revision and
  draft. It renders editor state, validation summary, section collection, limits,
  and Add section.
- `BookmarkSectionEditor` renders one ruled section and its ordered bookmarks.
  Each move control's accessible label includes its affected name; each remove
  path applies the PRD focus fallback.
- Use native text and URL inputs. Do not use contenteditable, drag handles as
  the only reorder mechanism, nested forms, or icon-only destructive controls.
- Use Lucide-equivalent Settings, X, ArrowUp, ArrowDown, Plus, Trash2, MapPin,
  RefreshCw, and Search SVG paths. Icons reinforce visible labels or carry
  programmatic labels; they do not create decorative noise.
- Prototype-only Review controls and state chooser do not ship.

## Design Tokens

All canonical values remain those in `pipeline/design-system.md`; no new global
token or pattern is required.

- **Ground and surface:** `--ground`, `--ground-deep`, `--surface`, and
  `--surface-raised`. The modal alone uses the approved transient raised surface
  and `0 14px 38px --shadow`; editor sections remain shadowless.
- **Text:** `--ink` for headings/values, `--ink-soft` for instructions, and
  `--ink-faint` for scope labels, ordinals, field labels, and metadata.
- **Rules:** `--line` between fields/bookmarks and `--line-strong` around the
  window and major region boundaries.
- **Accent:** `--gold` for selected preference underlines and the Save fill;
  `--gold-bright` for focus and action hover; `--gold-wash` for restrained
  hover/selection feedback.
- **State:** `--danger` for an error rule/text paired with words; `--green` is
  reserved for existing source freshness and never used to imply editor save.
- **Typography:** `--display` for the Settings title and section names,
  `--body` for instructions and inputs, and `--mono` for scope labels, field
  labels, ordinals, control labels, and status copy.
- **Shape:** 4–5px control radii, 1px rules, 2px bright-gold focus outline with
  3px offset. Modal corner radius is 6px on desktop and 0 on phone.
- **Spacing:** the existing 4, 8, 10, 12, 16, 18, 22, 24, 32, 38, and 48px
  scale. Desktop window inset is 24px; phone body inset is 16px.
- **Targets:** 38px compact desktop controls; at widths of 680px or less every
  editor action and trigger is at least 44px in both dimensions.

## Interaction Notes

- Opening Settings records the trigger, locks the background, performs a fresh
  editable-document read, and moves focus to the Settings heading/first
  meaningful control without scrolling the page.
- Tab and Shift+Tab wrap within the active dialog. Escape closes only a clean,
  non-saving window; with a dirty draft it opens discard confirmation; during
  Save it does nothing.
- Pointer interaction on the scrim does not close the window. Close and Cancel
  are explicit and equivalent for bookmark draft handling.
- Preference changes apply immediately and persist through the existing
  per-browser preference record. Their storage failure uses the shared status
  announcement and never disables the editor. Cancel does not revert them.
- Add section/bookmark appends in that collection and focuses the required name
  input. An empty named section remains valid. Add controls disable with adjacent
  limit copy at 20 sections, 50 bookmarks per section, or 100 total.
- One move activation changes exactly one position and retains focus on the
  activated control. First-item Move up and last-item Move down stay visible and
  disabled. There is no cross-section bookmark move in this release.
- Remove bookmark changes only the draft. Removing a non-empty section first
  opens an in-window confirmation that names the section and exact bookmark
  count; empty-section removal is immediate.
- Validation runs after a field is completed and on Save. Save with errors sends
  nothing, announces the count, and focuses the first invalid field. Trimmed
  names/URLs are reflected on successful validation.
- Save enables only for a loaded, dirty, valid, non-pending draft. During Save,
  fields and all mutate/dismiss controls disable as one group. A confirmed
  response updates only the bookmark renderer and snapshot, then closes.
- Conflict preserves the draft but blocks resubmission against the stale
  revision. Reload requires discard confirmation; Keep leaves the draft open.
- Draft keys, values, and revision remain in dialog memory only. They never
  appear in URLs, browser storage, telemetry, or third-party traffic.

## Motion Spec

- Settings window open: `cubic-bezier(.16, 1, .3, 1)`, 180ms, top-right edge
  nearest the Settings trigger, reduced motion 0.01ms with no spatial travel,
  CSS transition / Radix presence state.
- Settings window close: `ease-in`, 120ms, same top-right origin, reduced motion
  0.01ms, CSS transition / Radix presence state.
- Scrim enter/exit: `ease-out` enter 160ms and `ease-in` exit 120ms, viewport
  center with opacity only, reduced motion 0.01ms, CSS transition.
- Preference hover/selection: `ease`, 160ms, own baseline with color/background
  only, reduced motion 0.01ms, CSS transition.
- Add/remove/reorder feedback: `ease-out`, 150ms, changed row's leading rule,
  no scale or layout interpolation, reduced motion 0.01ms, CSS transition.
- Inline validation/status appearance: `ease-out`, 140ms, affected field's top
  edge with opacity/color only, reduced motion 0.01ms, CSS transition.
- Confirmation layer open: `cubic-bezier(.16, 1, .3, 1)`, 160ms, initiating
  Close/Cancel/Remove control edge, reduced motion 0.01ms with no transform,
  CSS transition / Radix nested dialog.
- Save pending icon: `linear`, 280ms per rotation, Save icon center, reduced
  motion one static frame at 0.01ms, CSS keyframes.
- Existing status toast: `cubic-bezier(.16, 1, .3, 1)`, 180ms, bottom-right
  edge, reduced motion 0.01ms, CSS transition.
- Confirmed bookmark replacement: immediate, 0ms, bookmark-owned region, same
  under reduced motion, React state update. No source region or page transition.

Motion explains entry, focus, validation, and state change only. There is no
staggered page reveal, hover scale, spring/bounce, blur-in, pulse, shimmer, or
motion-on-mount for static dashboard content.

## Content Notes

- Window name is exactly `Settings`; entry control is visibly labeled
  `Settings`, never a gear alone.
- Scope labels are concrete: `Only this browser` and `Every tailnet device`.
  The primary explanation is: `View and appearance stay on this browser. Saved
  bookmarks update homedash on every device connected through your tailnet.`
- Use `This browser`, `Display`, `Appearance`, `Shared bookmarks`, `Add
  bookmark`, `Add section`, `Move up`, `Move down`, `Remove`, `Cancel`, and
  `Save bookmarks`. Avoid technical terms such as CAS, schema, atomic rename,
  revision hash, source path, or serialization in product copy.
- Dirty copy says changes are staged; it never says saved. Success is exactly
  `Bookmarks saved.` only after confirmed server response or exact-match
  reconciliation.
- Removal confirmation names the section and count: `Remove “Daily” and its 2
  bookmarks from this draft? Nothing changes for other devices until you save.`
- Empty editor copy is `No sections yet. Add a section when you have somewhere
  new to go.` An empty named section uses `No bookmarks in this section yet.`
- Error copy is safe and actionable. It does not expose bookmark values, private
  hosts, configured paths, payload fragments, stack traces, or credentials.
- All dashboard data and bookmark values in the artifact are realistic samples,
  not live private readings. The prototype uses Gmail, Calendar, GitHub, eBird,
  and Macaulay Library solely to demonstrate realistic structure and fit.

## Design-System Status

No update to `pipeline/design-system.md` is required. The feature composes
already approved preference controls, focus, motion, status, responsive, and
transient raised-surface patterns. The full-viewport mobile treatment is an
instance of the existing bounded overlay requirement, not a new canonical
navigation or sheet pattern.
