# PRD — Settings Window and Bookmark Management

**Feature:** settings-window-and-bookmark-management  
**Date:** 2026-09-09  
**Stage:** 2 — The Planner  
**Source:** strategic-brief.md (approved)

## Feature Overview

This feature replaces the always-visible display and appearance controls with one accessible Settings window. The window keeps Dawn/Dense and System/Light/Dark as immediate, device-local preferences and adds a staged editor for the shared, server-owned bookmark sections. The owner can create, edit, remove, and explicitly reorder sections and bookmarks, then atomically replace the complete bookmark document with Save or leave it unchanged with Cancel.

The settings surface must preserve homedash's private tailnet boundary, one-store/two-renderer model, last-good bookmark behavior, favicon isolation, and normal one-screen dashboard contract. Opening or editing a draft never changes the dashboard. Only a confirmed save can replace the durable bookmark document and refresh the bookmark widget.

## User Stories

> **US-01** — As the owner, I want one clear Settings button instead of persistent presentation controls, so that the dashboard remains calm and leaves more room for morning context.

> **US-02** — As the owner on any of my devices, I want to add, rename, remove, and reorder bookmark sections and bookmarks without host access, so that I can maintain the start page where I notice a change.

> **US-03** — As a keyboard, touch, or assistive-technology user, I want explicit labeled move controls and predictable dialog focus, so that the complete workflow does not depend on drag-and-drop or precise pointer input.

> **US-04** — As the owner making several related changes, I want a staged draft with Save and Cancel, so that incomplete work never leaks onto the dashboard or into the shared configuration.

> **US-05** — As the owner using more than one tailnet device, I want stale edits rejected, so that an older Settings window cannot silently overwrite a newer save or direct host edit.

> **US-06** — As the owner upgrading an existing homedash, I want my flat bookmark file to keep working and migrate safely, so that this feature does not require a manual conversion or risk the last valid configuration.

## Functional Requirements

### Settings Entry, Dialog, and Existing Actions

> **FR-01** — The shared dashboard toolbar shall remove the always-visible Dawn/Dense and System/Light/Dark control groups and expose exactly one visibly labeled **Settings** button in both Dawn and Dense. The button shall not be an unlabeled gear-only control.

> **FR-02** — Kagi search, update-location, global refresh, source retry, launch links, bookmark navigation, and their current enabled, busy, focus, and announcement behavior shall remain available outside Settings; none shall be moved into bookmark administration.

> **FR-03** — The Settings trigger shall be keyboard operable, retain the established visible focus treatment, and provide a target at least 44×44 CSS pixels at viewport widths of 680 CSS pixels or less.

> **FR-04** — Activating Settings shall open one modal window with an accessible name of “Settings,” identify its descriptive persistence-scope text, move focus into the window, contain sequential focus within it, make the background unavailable to pointer and assistive-technology interaction, and prevent background page scrolling.

> **FR-05** — When the window has no unsaved bookmark changes and no save is pending, its Close control, Cancel, and Escape shall close it without changing dashboard scroll position or data and shall return focus to the same Settings trigger that opened it. Pointer interaction outside the window shall not silently close it.

> **FR-06** — At 360×800 and 1440×900 CSS pixels, the open window shall fit within the viewport without horizontal overflow; content that exceeds its available height shall scroll only inside the window while its title and Save/Cancel actions remain reachable.

> **FR-07** — The window shall visibly separate **This browser** settings from **Shared bookmarks** and explain in plain language that Dawn/Dense and appearance apply only to this browser while saved bookmarks apply to homedash on every tailnet device.

> **FR-08** — With Settings closed and the normal five-target/five-bookmark fixture, Dawn and Dense in System, Light, and Dark shall retain no document-level horizontal or vertical scrolling at 360×800 and 1440×900.

### Device-Local Presentation Settings

> **FR-09** — The **This browser** area shall offer exactly Dawn and Dense display modes plus System, Light, and Dark appearances, show the current selections, and apply each valid change immediately while the Settings window remains open.

> **FR-10** — Presentation changes shall continue to use the existing versioned per-browser preference record, default to Dawn and System when it is absent or invalid, and make System follow device appearance changes while the page is open; they shall send no bookmark mutation or preference write to the server.

> **FR-11** — Changing mode or appearance shall not close or reset the Settings window, change the bookmark draft or its dirty state, refetch any dashboard source, clear loaded widget values, or alter a Kagi query already entered.

> **FR-12** — If browser preference storage is unavailable, a presentation selection shall still apply for the current visit and the app shall announce that it could not be retained; this failure shall not disable bookmark editing or saving. Canceling bookmark changes shall never revert a presentation selection that was already applied.

### Editable Bookmark Draft

> **FR-13** — On every transition from closed to open, the Shared bookmarks area shall request the current canonical editable bookmark document and its opaque revision from the server. It shall never use the browser's last-good display snapshot as the editing base, and reading the document shall not rewrite or migrate it.

> **FR-14** — While that read is pending, the window shall keep device settings usable, show a bookmark-editor loading state, and disable bookmark mutation and Save. If the read fails, the window shall show an actionable retry without exposing file paths or internal details, keep device settings usable, and leave the durable document, dashboard bookmarks, and browser snapshot unchanged.

> **FR-15** — A successfully loaded document shall become an in-memory draft scoped to the open window. Adding, editing, removing, or reordering draft content shall not alter the durable document, either renderer, favicon eligibility, or the browser bookmark snapshot before a save is confirmed.

> **FR-16** — **Add section** shall append one empty section after the current last section and move focus to its required name field. An intentionally empty, validly named section shall be allowed to save.

> **FR-17** — The owner shall be able to edit a section name and remove a section. Removing a non-empty section shall first present a confirmation naming the section and the exact number of bookmarks that will also be staged for removal; confirming changes only the draft. Removing an empty section may change the draft immediately.

> **FR-18** — Within each section, **Add bookmark** shall append a bookmark and focus its required name field. The owner shall be able to edit that bookmark's name and URL or remove it from the draft. A bookmark shall belong to exactly one section, and this release shall not provide a direct move-to-another-section operation.

> **FR-19** — Every section and every bookmark within its section shall expose explicit **Move up** and **Move down** controls. One activation shall move that item by exactly one position; the unavailable direction at the first or last position shall remain visibly disabled. Reordering shall not require or assume drag-and-drop.

> **FR-20** — Draft controls shall have programmatic labels that include the affected section or bookmark and action, work by keyboard and touch, and provide at least 44×44 CSS-pixel targets at widths of 680 pixels or less. A move shall retain focus on the activated move control; after a removal, focus shall move to the next item of the same type, otherwise the previous item, otherwise that collection's Add control.

> **FR-21** — Bookmark-draft dirty state shall mean that the complete draft differs from the document loaded or last confirmed by this window. Cancel, Close, or Escape with a dirty draft shall open an in-window confirmation with exactly **Discard bookmark changes** and **Keep editing** actions; discard shall close without a write, while keep editing shall restore focus to the initiating control. Device-local presentation changes alone shall not make the bookmark draft dirty.

> **FR-22** — After a draft is discarded or the window is closed, no draft shall persist in localStorage, sessionStorage, Cache Storage, a URL, or a durable browser file. The next open shall read a fresh server document and revision.

### Validation and Product Limits

> **FR-23** — Before comparison or save, leading and trailing whitespace shall be removed from section names, bookmark names, and URLs. A section name shall contain 1–40 Unicode characters after trimming, a bookmark name 1–100, and neither name shall contain a line break or control character. Interior whitespace and the submitted display casing shall otherwise be preserved.

> **FR-24** — Section names shall be unique across the document after trimming, Unicode normalization, and case-insensitive comparison. The conflicting section-name fields shall each identify the duplicate. Duplicate bookmark names or destinations are allowed because bookmark names are not identifiers.

> **FR-25** — A bookmark URL shall contain no more than 2,048 Unicode characters after trimming, shall be an absolute HTTP or HTTPS URL accepted by the established shared URL policy, and shall contain no username or password. Fragments, paths, and queries remain allowed; script, data, file, relative, malformed, and credential-bearing destinations shall be rejected.

> **FR-26** — One document shall contain at most 20 sections, at most 50 bookmarks in one section, and at most 100 bookmarks total. Add controls shall become disabled with an explanation at the applicable limit, and the server shall enforce the same limits independently.

> **FR-27** — The complete encoded save request shall not exceed 65,536 bytes. The client shall identify an over-limit draft before submission when it can do so, and the server shall reject any oversized or structurally excessive request before a durable write.

> **FR-28** — Validation shall run as fields are completed and again on Save. Every invalid field shall have an inline, programmatically associated message; document-level count or size errors shall appear in a summary. A Save attempt with errors shall perform no request, announce the number of errors, and focus the first invalid field or, if none, the error summary.

> **FR-29** — Zero sections, zero total bookmarks, and named empty sections shall be valid saved states. The editor shall distinguish “No sections yet” from an empty named section, and both dashboard renderers shall use the saved empty-state behavior defined in FR-43.

### Whole-Document Save, Concurrency, and Failure Behavior

> **FR-30** — Save shall be enabled only after the current editable document has loaded, the bookmark draft is dirty, all client validation passes, and no save is pending. One activation shall start one request; bookmark fields, reorder/remove/add controls, repeat Save, Close, Cancel, and Escape dismissal shall remain disabled until that request resolves, and the window shall expose and announce its saving state.

> **FR-31** — A save request shall contain the entire ordered candidate document and the exact revision obtained with its editing base. It shall express one whole-document replacement, never a sequence of per-section or per-bookmark durable mutations.

> **FR-32** — The server shall parse and validate the complete candidate independently against FR-23 through FR-29 before writing. Any malformed field, duplicate section, unsupported document version, excessive count, excessive size, unknown property that makes the contract invalid, or invalid URL shall reject the entire candidate with no partial persistence.

> **FR-33** — Immediately before replacement, the server shall compare the supplied revision with the current durable bookmark content. If another successful save or a direct host edit changed that content, it shall reject the candidate as stale with a conflict response; same-content metadata or timestamp changes need not create a conflict. Concurrent saves shall be ordered so at most one candidate based on a given revision can succeed.

> **FR-34** — On a stale-write response, the window shall keep the complete draft visible and editable, announce that saved bookmarks changed elsewhere, and prevent another save against the stale revision. It shall offer **Reload saved bookmarks** and **Keep this draft open**; reload shall require confirmation before discarding the draft, then load the current document and revision. This release shall provide neither force-overwrite nor automatic merge.

> **FR-35** — On server validation, connectivity, or storage failure, the window shall remain open, preserve the complete draft in memory, restore its editing controls, present field errors or one safe actionable error as applicable, and leave the displayed dashboard and browser snapshot unchanged. If a response is lost after the server may have committed, a retry or reconciliation read shall treat an exact canonical match as the confirmed save and otherwise enter the stale flow; it shall never claim success without server confirmation.

> **FR-36** — A durable replacement shall be atomic: after any validation error, write error, interruption, or process failure, the configured bookmark path shall resolve to either the complete prior document or the complete validated new document, never a missing, truncated, mixed, or partially reordered document. A failed write shall not displace the service's last valid in-memory bookmark state.

> **FR-37** — A successful save response shall return the complete canonical saved document and its new revision. Only after receiving or reconciling that confirmation shall the initiating browser replace the bookmark widget data in both modes and update its validated `homedash.cache.bookmarks.v1` display snapshot; browser snapshot failure shall not roll back a confirmed server save.

> **FR-38** — After a confirmed save, the window shall close, return focus to Settings, and announce **Bookmarks saved**. The dashboard update shall not reload the page, move document scroll, refresh weather, eBird, or llmdash, retry location, alter presentation preferences, or clear the Kagi query.

> **FR-39** — Other open devices are not required to update live. They shall receive the new shared bookmark state on their next ordinary bookmark refresh, global refresh, or page load, subject to the existing last-good snapshot and stale-state behavior.

### Legacy Migration and Saved Presentation

> **FR-40** — A valid legacy flat bookmark array within the limits in this PRD shall remain readable without manual conversion. Its first-seen group order shall become section order, and bookmarks sharing a group shall retain their relative legacy file order within that section, including when same-group entries were not contiguous.

> **FR-41** — Reading or opening a legacy document shall never modify it. Its conversion to the explicit versioned ordered-section format shall occur only as part of a successful, fully validated atomic Save; failure before confirmation shall leave the legacy bytes usable at the configured path.

> **FR-42** — An unreadable legacy file, a legacy entry that fails the established name/URL/group policy, or a legacy document outside the new count or size limits shall not be silently repaired, omitted from an editable replacement, or overwritten from Settings. The bookmark editor shall be read-only with an actionable host-configuration message, while the dashboard retains its existing last-good/stale or unavailable behavior and device settings remain usable.

> **FR-43** — Dawn and Dense shall render the same confirmed section order, bookmark order, names, destinations, and saved-state availability. A named empty section shall render its heading plus “No bookmarks” in both modes; a document with zero sections shall render the existing overall no-bookmarks state. Exceptional payload overflow shall remain bounded to the bookmark-owned region.

> **FR-44** — After a confirmed save, bookmark links shall remain native same-tab HTTP(S) anchors with 48×48 CSS-pixel mobile targets and decorative fixed-slot favicon/fallback behavior. A removed or destination-changed bookmark shall never receive its former destination's cached icon; unavailable icons shall remain presentation-only failures and shall not affect save success, bookmark order, widget freshness, or navigation.

## Non-Functional Requirements

> **NFR-01 — Accessibility:** The Settings trigger, modal, fields, errors, confirmation states, status messages, and explicit reorder controls shall meet WCAG 2.2 AA keyboard, focus-visible, contrast, name, description, error-identification, and status-announcement expectations without color-only meaning.

> **NFR-02 — Responsive Layout:** The closed release matrix shall retain the existing one-screen contract, and the open Settings workflow shall remain usable without document or horizontal scrolling at 360×800 and 1440×900, with all exceptional vertical overflow contained inside the modal.

> **NFR-03 — Interaction Performance:** Opening and draft reordering shall respond in the next rendered frame for an already loaded interface; bookmark names and dashboard actions shall remain usable while the editable document is loading or a save is pending. Network and storage work shall not block mode or appearance changes.

> **NFR-04 — Resilience:** Any editor read, validation, conflict, network, snapshot, or durable-write failure shall remain isolated to the documented editor state and preserve the last valid dashboard and other widget data without an uncaught page failure.

> **NFR-05 — Security and Privacy:** Bookmark editing shall use same-origin reads and state-changing requests only, reject cross-origin or unsupported-content mutation attempts, and expose no bookmark document through URLs, telemetry, third-party services, client-visible logs, stack traces, or error reflections. Existing tailnet-only delivery and browser CSP boundaries remain unchanged.

> **NFR-06 — Integrity:** Revision verification and durable replacement shall behave as one serialized operation across simultaneous saves and direct host edits, and the service shall not acknowledge success until the complete new document is the authoritative readable state.

> **NFR-07 — Compatibility:** The complete settings and bookmark workflow shall work in the current and previous major Safari, Chrome, and Firefox releases, including the existing mobile Safari profile, without relying on drag-and-drop, hover, or a browser-extension API.

> **NFR-08 — Motion and Visual Stability:** The window and validation states shall respect reduced-motion preference. Opening, field errors, favicon state, and reordering shall not animate content unexpectedly or move the background dashboard.

> **NFR-09 — Resource Bounds:** Both browser and server shall enforce the 20-section, 50-per-section, 100-total-bookmark, 2,048-character-URL, and 65,536-byte request limits before unbounded parsing, rendering, validation, or persistence work; rejected payloads shall not create durable or process-lifetime draft state.

## Out of Scope

- Accounts, roles, application-level login, public-internet administration, multi-owner collaboration, approvals, audit history, or revision history.
- Synchronizing Dawn/Dense or System/Light/Dark between devices, changing `homedash.preferences.v1`, or storing presentation preferences on the server.
- More than one bookmark collection, nested sections, section-within-section hierarchy, or moving a bookmark directly between sections.
- Bookmark tags, search, favorites, descriptions, notes, custom colors, uploaded icons, custom favicon URLs, or per-bookmark presentation options.
- Browser-native bookmark import/export, external bookmark-service sync, browser-extension APIs, bulk URL ingestion, automatic discovery, or webpage metadata scraping.
- Drag-and-drop as a required interaction, autosave, per-row server mutation, offline editing, durable browser drafts, force-overwrite, automatic conflict merge, or undo history after a confirmed save.
- Automatically fixing or replacing an invalid host file, keeping a durable backup/history after a successful atomic replacement, or adding a database.
- Live multi-device updates; the normal refresh and page-load paths are sufficient.
- Moving Kagi, location, refresh, launch, source-retry, or other dashboard actions into Settings or turning Settings into a general administration console.
- Redesigning Dawn or Dense, changing the four-widget product scope, adding a display mode, weakening favicon safety, or relaxing the closed-dashboard one-screen contract.

## Open Questions

None — all product decisions and failure defaults required for implementation are resolved in this document.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Shared Settings entry and existing actions (FR-01–FR-03) | Dawn and Dense each show one visibly labeled, keyboard-operable Settings button with a measured 44×44 mobile target and no external mode/appearance groups; Kagi, location, global/source refresh, launch links, and bookmark navigation retain their prior behavior and focus states. |
| QA-02 | Modal semantics and clean close (FR-04–FR-06; NFR-01, NFR-02) | Accessibility inspection exposes one named/described modal, focus enters and cycles only within it, the background is inert and stationary, outside click does not close it, and Close/Cancel/Escape from a clean state return focus to Settings without scroll or data changes at 360×800 and 1440×900. |
| QA-03 | Persistence explanation and closed viewport matrix (FR-07, FR-08; NFR-02) | The two persistence scopes are plainly visible, and both modes in all three appearances with the normal fixture have no document horizontal or vertical overflow at 360×800 and 1440×900 after Settings closes. |
| QA-04 | Immediate device settings (FR-09–FR-12) | All five selections apply immediately and survive reload in the current browser, System follows a simulated device-theme change, another browser remains independent, the modal and dirty draft survive mode/appearance changes, no source request fires, and blocked local storage yields current-visit behavior plus an accurate announcement without blocking bookmarks. |
| QA-05 | Canonical editor loading and read failure (FR-13–FR-15; NFR-03, NFR-04) | Each open performs a fresh editable-document read and no write, never seeds from a poisoned or valid display snapshot, keeps device controls responsive, disables editing while pending, and on timeout/malformed/error offers retry while durable, dashboard, snapshot, and other widget state remain byte-for-byte/logically unchanged. |
| QA-06 | Section and bookmark create/edit/remove (FR-16–FR-18) | Add actions append and focus the documented field; names and URLs are editable; bookmark removal is staged; empty-section removal is immediate in the draft; non-empty-section removal names the section and exact child count and removes both only after confirmation; no action changes the dashboard before Save. |
| QA-07 | Explicit reorder and focus (FR-19, FR-20; NFR-01, NFR-07) | Keyboard and touch tests move sections and within-section bookmarks exactly one slot, expose named 44×44 controls, keep boundary controls disabled, preserve focus after moves, apply the documented focus fallback after removal, and complete without drag, hover, or horizontal overflow. |
| QA-08 | Dirty close, Cancel, and draft lifetime (FR-21, FR-22) | Content-equivalent drafts close cleanly; each dirty close path offers only Discard/Keep editing, Keep restores initiating focus, Discard performs zero writes and returns focus to Settings, device preferences remain applied, no draft exists in browser storage or URL, and reopening reads current server state. |
| QA-09 | Name and duplicate validation (FR-23, FR-24) | Boundary fixtures accept 1/40-character sections and 1/100-character bookmarks after trim, reject empty/overlong/control-containing values, preserve valid interior text/casing, flag all normalized case-insensitive duplicate sections, and allow duplicate bookmark labels and URLs. |
| QA-10 | URL policy (FR-25) | Absolute credential-free HTTP(S) URLs through 2,048 characters with valid paths/queries/fragments save; 2,049-character, relative, malformed, script, data, file, and credential-bearing values show associated errors and produce no mutation request. |
| QA-11 | Count and encoded-size bounds (FR-26, FR-27; NFR-09) | Boundary fixtures accept 20 sections, 50 bookmarks in one section, 100 total, and a 65,536-byte request; each next unit is blocked or rejected with an explanation, raw oversized/structurally excessive requests fail before persistence, and no rejected draft remains in server process or durable state. |
| QA-12 | Validation UX and empty states (FR-28, FR-29; NFR-01) | Inline errors are associated with every field, document errors use the summary, invalid Save sends no request and announces/counts/focuses correctly, and zero sections plus named empty sections are valid and visually distinct in the editor. |
| QA-13 | Save eligibility and whole-document contract (FR-30–FR-32) | Save is disabled for loading, pristine, invalid, and pending states; a valid dirty activation sends one complete ordered candidate with its base revision, announces saving, disables duplicate mutation and every dismissal path until resolution, and server-side cases for every client rule reject the whole candidate with no partial change. |
| QA-14 | Stale-write protection and recovery (FR-33, FR-34; NFR-06) | Two editors opened at one revision cannot both save; the second and a draft made stale by a content-changing host edit receive conflict, preserve the full draft, cannot resubmit stale, expose Reload/Keep, confirm before reload discard, and provide no force or automatic merge; a same-content metadata-only touch does not falsely conflict. |
| QA-15 | Failure isolation and ambiguous response (FR-35; NFR-04) | Validation, offline, timeout, closed connection, and storage-error fixtures keep the window and draft available, restore controls, expose safe actionable errors, and leave dashboard/snapshot unchanged; a lost success response reconciles an exact canonical match as success and routes a differing state to conflict without a false success message. |
| QA-16 | Atomic durable replacement (FR-36; NFR-06) | Fault injection before, during, and after replacement plus process restart yields exactly the complete prior or complete new document at the configured path, never missing/truncated/mixed data; failed writes retain the service's prior readable last-good state, and acknowledged saves reload as the authoritative new state. |
| QA-17 | Confirmed-save UI and scoped refresh (FR-37, FR-38) | No dashboard or snapshot change occurs before confirmation; success returns canonical data/revision, updates identical bookmark state in both modes and the validated snapshot, closes and focuses Settings, announces “Bookmarks saved,” and causes no navigation, scroll, weather/eBird/llmdash/location request, preference change, or Kagi reset. |
| QA-18 | Shared state timing (FR-39) | A second open device is not pushed a live change but obtains the saved canonical document in order through bookmark refresh, global refresh, or reload while existing last-good/stale behavior remains intact during a forced read failure. |
| QA-19 | Legacy ordering and write-safe conversion (FR-40, FR-41) | Valid flat fixtures, including noncontiguous repeated groups, load with first-seen section order and within-group relative bookmark order; open/read/cancel/failing-save preserve the original bytes, and only a successful atomic Save produces the versioned ordered-section document. |
| QA-20 | Invalid and excessive legacy handling (FR-42; NFR-04) | Malformed, invalid-entry, over-count, and over-size legacy fixtures remain untouched, make bookmark editing read-only with safe host guidance, leave device settings usable, and preserve the established dashboard last-good/stale or unavailable result without constructing an omitted-data replacement. |
| QA-21 | Renderer parity and saved empty states (FR-43; NFR-02) | One canonical fixture renders identical section and bookmark order, names, URLs, and availability in Dawn and Dense; empty named sections show heading plus “No bookmarks,” zero sections show the overall empty state, and oversized payloads scroll only in the bookmark-owned region. |
| QA-22 | Link, target, favicon, and cache regression (FR-44) | Added and edited links remain native same-tab credential-free HTTP(S) anchors with measured 48×48 mobile targets and decorative stable icon slots; removed or changed destinations cannot receive former cached icons; rejected/timed-out icons show fallback without changing save, order, freshness, or navigation. |
| QA-23 | Responsiveness, performance, motion, and compatibility (NFR-03, NFR-07, NFR-08) | Current/previous Safari, Chrome, and Firefox plus the mobile Safari profile complete the keyboard/touch workflow; already-loaded opens and reorder actions paint on the next frame, delayed reads/saves do not block dashboard actions or device choices, reduced-motion removes nonessential motion, and the background layout does not shift. |
| QA-24 | Privacy and mutation boundary (NFR-05) | Browser/network inspection shows editor traffic only to same-origin bookmark resources, cross-origin and unsupported-content mutations are rejected, CSP and tailnet delivery remain unchanged, and document values, file paths, credentials, payloads, stacks, and errors appear in no URL, third-party request, telemetry event, or client-visible log. |
| QA-25 | Full regression suite (FR-01–FR-44; NFR-01–NFR-09) | Existing static, unit, integration, accessibility, production-build, favicon, cache, refresh, source-isolation, and Playwright one-screen tests pass alongside the new migration, editor, concurrency, atomicity, and supported-browser coverage. |
