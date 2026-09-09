# Strategic Brief — Settings Window and Bookmark Management

## What We're Building
Replace the persistent top settings controls with one clear Settings button that opens an accessible settings window. The window retains the existing Dawn/Dense and System/Light/Dark controls and adds a focused editor for creating, removing, and reordering bookmark sections and the bookmarks within them.

This feature deliberately changes an earlier product boundary: the host bookmark file is no longer managed only outside homedash. It remains the private, durable source of truth, but the single owner can now update it through a validated in-app workflow. Dawn and Dense continue to render the same saved bookmark structure, and the closed dashboard retains its one-glance behavior on phone and desktop.

## Why Now
The roadmap left richer bookmark management open until editing the host configuration proved cumbersome. This saved idea is that explicit product decision. Bookmarks are a frequent start-page action, but changing their names, destinations, grouping, or order currently requires reaching the host, editing JSON correctly, and reloading the page. That is disproportionate friction for routine personal organization, especially from a phone.

Consolidating settings at the same time also recovers scarce viewport space. One settings entry point keeps presentation controls available without leaving two toggle groups permanently across the top of every dashboard view. The result should feel like a calmer start page and a safer, more direct way to maintain one of its four founding widgets.

## The User Problem
The owner needs to adjust the start page from the device where they notice the problem. Today they cannot add a useful destination, remove a stale one, or change bookmark and section order without host access and manual file editing. The always-visible settings controls also consume room even though appearance and display mode change infrequently.

The owner needs one discoverable settings surface that distinguishes device-specific presentation choices from shared bookmark content, makes ordered changes usable with touch and keyboard, and protects the last saved configuration if validation, storage, or connectivity fails.

## Success Criteria
- The full-width top settings controls are replaced by one clearly labeled, keyboard-operable Settings button; opening and closing the window manages focus predictably and does not disturb the dashboard's current data or scroll position.
- The settings window preserves the existing Dawn/Dense and System/Light/Dark choices, their immediate visual effect, and their versioned per-browser persistence. Changing one device does not change another device's presentation.
- The owner can add and remove bookmark sections, edit section names, and reorder sections without manually editing the host file.
- Within each section, the owner can add, edit, remove, and reorder bookmarks using name and URL fields. Reordering works by keyboard and touch controls and does not depend on drag-and-drop.
- A successful save becomes the single shared bookmark state served to both Dawn and Dense, including section order and bookmark order, and is reflected in the dashboard without a full-page reload.
- Existing bookmark URL policy remains enforced: only valid HTTP(S) destinations without embedded credentials can be saved. Empty labels, duplicate section ambiguity, excessive input, and malformed payloads receive field-level or actionable errors without partial persistence.
- Bookmark changes are staged until one explicit Save. Cancel leaves the durable configuration unchanged; a failed save keeps the draft available for correction or retry while the dashboard continues showing the last valid saved bookmarks.
- The server validates the complete candidate and replaces the durable bookmark document atomically. Validation, write, or migration failure never truncates or partially replaces the last valid configuration.
- A stale editor cannot silently overwrite a newer save from another device or a direct host edit; it must reload or deliberately reconcile the current server version before saving.
- Existing legacy flat bookmark configuration loads without manual intervention. Its order and grouping are preserved when represented as sections, and conversion to the versioned editable format occurs only through a recoverable, validated write.
- The settings window explains the persistence boundary in plain language: view and appearance apply to this browser, while saved bookmarks apply to this homedash across its tailnet devices.
- Kagi search, location retry, global and source refresh, launch links, favicon fallback, source isolation, cached readings, and ordinary bookmark navigation remain available and retain their existing behavior.
- With settings closed, the normal five-target/five-bookmark dashboard still avoids document scrolling at 1440×900 and 360×800 in Dawn and Dense. With settings open, any overflow is contained within the window and the background page does not scroll.

## Scope
- Replace the always-visible mode and appearance groups with one Settings trigger and an accessible modal window or equivalent bounded overlay shared by Dawn and Dense.
- Retain the existing per-browser display-mode and appearance behavior inside a clearly identified device-settings section.
- Add one bookmark-management section for ordered bookmark sections and ordered bookmark records, including create, rename/edit, remove, and move controls.
- Support explicit Save and Cancel behavior, inline validation, unsaved-change protection on attempted close, save progress, success feedback, and recoverable failure feedback.
- Extend the same-origin bookmark API with the minimum read/write contract needed to load the current editable document, validate a complete replacement, detect stale writes, save atomically, and return the resulting canonical state.
- Introduce a versioned server-side bookmark document capable of representing ordered sections, including an intentionally empty section, while safely reading and migrating the current flat-array configuration.
- Preserve private bookmark data on the server and in same-origin responses only; do not place the editable bookmark source in local storage, repository files, URLs, logs, telemetry, or third-party services.
- Refresh the bookmark widget and its validated browser snapshot only after a confirmed save, with equivalent data and order in both presentations.
- Preserve the existing favicon and link behavior as bookmarks are added, edited, moved, or removed; icon failure remains a presentation-only fallback.
- Add automated coverage for migration, validation, atomic failure behavior, stale-write handling, ordering, zero/empty states, mode parity, accessible dialog and reorder interactions, responsive containment, and regression of existing dashboard actions.

## Out of Scope
- Accounts, roles, permissions, multiple bookmark collections, per-user views, sharing, approval workflows, audit history, or public-internet administration.
- Synchronizing Dawn/Dense or System/Light/Dark preferences between devices, or moving those preferences out of the existing browser-owned record.
- Importing browser-native bookmarks, exporting/syncing with external bookmark services, browser-extension APIs, bulk scraping, or automatic bookmark discovery.
- Bookmark tags, search, favorites, nesting beyond one section level, descriptions, notes, custom colors, custom uploaded icons, or per-bookmark appearance settings.
- Concurrent collaborative editing or live multi-device updates; safe stale-write rejection is sufficient for this single-owner product.
- Autosaving each edit, background writes, offline bookmark editing, persistent browser drafts, undo history after a confirmed save, or a database.
- Turning source refresh, location, Kagi, or other dashboard behavior into a broad preferences or administration system.
- Redesigning Dawn or Dense, adding a widget or display mode, changing bookmark destinations automatically, or relaxing the established one-screen dashboard contract.

## Key Decisions
- **The earlier boundary is explicitly superseded, not ignored.** `CLAUDE.md`, `PRODUCT_CONTEXT.md`, and prior briefs intentionally prohibited an in-page editor absent a product decision. This saved feature is that decision: homedash may now edit bookmarks, while the durable private host configuration remains canonical.
- **There is one bookmark store.** The browser holds only an in-memory editing draft and the existing validated display snapshot. Successful edits replace the server-owned bookmark document; local storage must not become a competing source of bookmark membership or order.
- **The bookmark file evolves to ordered sections.** The existing flat array cannot faithfully represent an empty section. A versioned document with an ordered section collection is the smallest durable model that satisfies add/remove/reorder for both sections and bookmarks.
- **Migration is compatibility-first and write-safe.** The server reads the legacy flat list in its current first-seen group and file order. It writes the new format only after full validation through an atomic, recoverable path; an unreadable legacy file is never overwritten merely because the settings window opened.
- **A save is an atomic whole-document replacement.** The owner stages related changes and commits once. Server validation and a revision precondition prevent partial state and silent last-writer-wins loss while avoiding the complexity of per-row mutation endpoints.
- **Persistence scopes stay visibly distinct.** Mode and appearance remain device-owned in `homedash.preferences.v1`; bookmarks are shared server-owned content. Housing both in one window does not merge their storage or synchronization semantics.
- **Reordering cannot be drag-only.** Explicit move controls provide the baseline for touch, keyboard, and assistive technology. Drag-and-drop may be added only as a redundant enhancement if it does not compromise the smaller workflow.
- **Deletion is reversible until Save.** Removing a bookmark or section changes only the draft. Cancel restores the current saved state; removing a section makes the bookmarks it contains part of the staged deletion and must be communicated before commit.
- **Existing actionability remains protected.** Collapsing settings must not remove or bury Kagi search, refresh, location retry, launch links, or bookmark navigation. Their exact compact placement is a design decision, but they remain first-class dashboard actions rather than being conflated with bookmark administration.
- **The settings window owns its overflow.** The dashboard's approved 1440×900 and 360×800 no-document-scroll contract applies when the window is closed; a long editor scrolls internally, contains focus, and prevents background scrolling when open.
