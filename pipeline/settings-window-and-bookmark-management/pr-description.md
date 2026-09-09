## Settings Window and Bookmark Management

### What this does

Replaces the persistent display and appearance controls with one visibly labeled, accessible Settings window. Dawn/Dense and System/Light/Dark remain immediate browser-only preferences, while a separate in-memory bookmark draft lets the owner add, rename, remove, and explicitly reorder sections and bookmarks before one whole-document Save.

The server now accepts the existing legacy flat array and a strict ordered V1 document, exposes one fresh same-origin document resource, rejects stale revisions, and persists confirmed replacements through a synced same-directory temporary file plus atomic rename. The initiating dashboard accepts only the server-confirmed bookmark projection; weather, eBird, llmdash, location, search text, and presentation preferences are not refreshed or replaced.

### How to test

1. Run `npm install`, then `npm run dev`.
2. Open `http://127.0.0.1:5173` and confirm the toolbar exposes one **Settings** button in Dawn and Dense.
3. Open Settings and switch display and appearance. Confirm each change applies immediately, remains after Cancel, and does not change the bookmark draft.
4. Add a section and bookmark, edit names and the HTTP(S) address, use the explicit move controls, and remove an item. Confirm the dashboard remains unchanged until Save.
5. Try an empty name, invalid or credential-bearing URL, and duplicate section name. Confirm inline errors identify every affected field and Save remains unavailable.
6. Close or press Escape with a dirty draft. Keep editing once, then discard; reopen Settings and confirm it performs a fresh read rather than restoring the discarded draft.
7. Save a valid change. Confirm Settings closes, focus returns to its trigger, “Bookmarks saved.” is announced, and both renderers show the same saved section and bookmark order. A named empty section should show “No bookmarks.”
8. At 360×800 and 1440×900, confirm the modal remains inside the viewport, background scrolling and interaction are blocked, overflow stays inside the window, and mobile Settings/editor controls meet the 44×44 target baseline.
9. Run `npm run check`, `npm run test:e2e`, and `~/.weft/bin/weft-design-lint check src`.

### Notes for reviewer

- Existing valid legacy files are read and converted only in memory. A changed, confirmed Save is the migration point; opening, canceling, or retrying never rewrites the source.
- Partial or normalized-name-ambiguous legacy content may remain visible on the dashboard but is never offered as an editable base.
- PUT is a serialized whole-document compare-and-swap. Exact candidate/current equality is an idempotent success path for a lost response; other stale drafts require an explicit reload and are never force-merged.
- Both document methods require a raw Host from the exact configured origin list and validate any supplied Origin. Forwarded host/protocol headers never grant access. The installer records exact loopback and installed Tailscale HTTPS origins.
- New installs keep the `0600` bookmark file in a dedicated `0700` state directory. The generated service unit retains `ProtectHome=read-only` and grants `ReadWritePaths=` only after rejecting broad, sensitive, or mixed-use custom parents; existing files in dedicated safe directories and the prior narrow default location are preserved.
- Source reads use one no-follow descriptor, a max+1 bounded read, and same-handle/path-identity checks before parsing.
- Other open devices update on their next normal bookmark refresh or reload. There is no live synchronization, force overwrite, history, import/export, drag-and-drop, or direct bookmark move between sections in this release.
- A host editor can still race in the small portable check-to-rename interval. Host edits should use atomic rename and should not run during an in-app save.
