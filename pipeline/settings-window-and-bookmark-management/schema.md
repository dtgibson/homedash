# Schema — Settings Window and Bookmark Management

## Path

**Incremental (Extending existing schema).** Homedash already has one Fastify/Node process, one React client, four version-1 widget envelopes, browser-owned preferences and last-good snapshots, a private host bookmark file, and a bounded process-only favicon cache. This feature deliberately changes the approved bookmark-file boundary from read-only to editable, but keeps the file as the only durable bookmark store. It adds a versioned ordered-section document and a whole-document read/replace API; it does not add a database, ORM model, migration directory, or second bookmark store.

## Current Schema State

### Application and persistence boundaries

Homedash remains one React/Vite/TypeScript application served by one Fastify/Node process on loopback port `1910`, with Tailscale providing the private HTTPS boundary.

| Owner | Cumulative durable state after this feature |
|---|---|
| Browser | `homedash.preferences.v1`, `homedash.location.v1`, and independently validated `homedash.cache.<widget>.v1` snapshots for weather, bookmarks, eBird, and llmdash. The open bookmark draft, its base revision, validation errors, and dialog state are memory-only. |
| Host | Private environment configuration and the single file selected by `BOOKMARKS_PATH`. That file may be the legacy flat array or the new versioned ordered-section document. |
| Fastify process | Existing source caches, bookmark last-good state/current registry, the bounded favicon cache, and one FIFO bookmark-file operation mutex. All are replaceable on restart. |
| Upstream systems | Open-Meteo, SnowRaven/eBird, llmdash, and eligible bookmark favicon origins retain their prior responsibilities. Bookmark document reads and writes contact no upstream. |

Device presentation remains separate from shared content. Dawn/Dense and System/Light/Dark still apply immediately through `homedash.preferences.v1`; they never enter a bookmark request. The settings dialog does not create another persistence scope merely because it presents both kinds of setting.

Private configuration remains cumulative: host/port, exact `HOMEDASH_ALLOWED_ORIGINS`, Home location, weather units, SnowRaven and llmdash URLs, eBird limits, `BOOKMARKS_PATH`, and the existing upstream timeout. The origin list contains canonical comma-separated HTTPS origins plus exact loopback HTTP origins; the installer derives the installed Tailscale DNS origin rather than accepting request-derived host data. No bookmark-editor secret or database URL is introduced. The favicon route retains its independent absolute two-second deadline; editor file I/O does not consume or reset that deadline.

### Canonical durable bookmark document

The new on-disk form is a strict JSON document:

```ts
type BookmarkDocumentV1 = {
  schemaVersion: 1
  sections: Array<{
    name: string
    bookmarks: Array<{
      name: string
      url: string
    }>
  }>
}
```

Example:

```json
{
  "schemaVersion": 1,
  "sections": [
    {
      "name": "Daily",
      "bookmarks": [
        { "name": "Calendar", "url": "https://calendar.google.com" }
      ]
    },
    { "name": "Projects", "bookmarks": [] }
  ]
}
```

Object properties are closed at every level: unknown properties, missing properties, a non-integer or unsupported `schemaVersion`, sparse/non-array collections, and non-string leaf values invalidate a candidate. Array order is section order and bookmark order. A document with no sections and a named section with no bookmarks are both valid and distinct. No durable row ID, UI key, revision, favicon value, timestamp, or deletion marker is stored in this file.

The complete validation contract is:

- At most 20 sections, 50 bookmarks in any section, and 100 bookmarks in total.
- Apply ECMAScript `String.prototype.trim()` to every section name, bookmark name, and URL before validation, dirty comparison, response, revision calculation, or persistence.
- Count text limits by Unicode code points, not UTF-16 code units. Section names contain 1–40 code points and bookmark names 1–100 code points.
- Names reject all Unicode `Cc` control characters and the line separators U+2028/U+2029. Valid interior whitespace and submitted casing are otherwise retained.
- A section duplicate key is `trimmedName.normalize('NFKC').toLocaleLowerCase('en-US')`. Every section name must have a unique key. Normalization is for comparison only; the retained display name is the trimmed submitted string.
- URLs contain at most 2,048 code points after trimming and must pass the existing shared WHATWG URL policy: absolute `http:` or `https:`, a hostname, and no username or password. Path, query, fragment, textual host casing, percent encoding, and other valid submitted spelling are retained rather than rewritten through `.href`.
- The UTF-8 request body for a replacement, including the request wrapper and revision, is at most 65,536 bytes. The UTF-8 legacy or versioned source file is also capped at 65,536 bytes before read/parse. These byte bounds make JSON parsing and all subsequent validation bounded.

Canonical JSON is constructed from the validated values in the property order shown above and encoded as compact UTF-8 `JSON.stringify(document)`. The durable file is those bytes plus one LF. This property order and whitespace are serialization rules, not additional user data.

### Content revision and generated bookmark identity

An editing revision is the ASCII string `sha256:` followed by the 64 lowercase hexadecimal characters of SHA-256 over the canonical JSON bytes **without** the trailing LF. It covers document version, section order/names, bookmark order/names, and URLs. It excludes source path, inode, permissions, object-key/JSON whitespace, trailing LF, and timestamps. The client treats it as opaque and validates only the bounded shape `^sha256:[a-f0-9]{64}$`.

Consequences:

- Touching the file or reformatting semantically identical content does not make an editor stale.
- Reordering, renaming, adding, removing, or changing a URL changes the revision.
- A valid legacy array is first converted in memory to `BookmarkDocumentV1`; its revision is the digest of that canonical representation. Reading it never writes it.

The public `Bookmark` identity contract remains the existing lowercase 16-hex prefix of SHA-256 over `name + NUL + url + NUL + order`. For a versioned document, `order` is the zero-based depth-first ordinal through sections and their bookmarks. For an unmigrated legacy array, the source-array index remains the `order` input so merely installing this feature does not remint current favicon IDs. A successful migration may remint IDs where legacy entries were noncontiguous by group; IDs are opaque presentation handles, not durable identities.

### Legacy flat-array compatibility

The prior form remains readable:

```ts
type LegacyBookmarkFile = Array<{
  group?: string // defaults to "Bookmarks"
  name: string
  url: string
}>
```

Legacy entry parsing retains the prior behavior for the dashboard: unknown legacy properties are ignored, invalid individual entries may be omitted and counted, and source indices remain their display `order`. A legacy file is editable only when every entry satisfies the new name/URL rules, all new count/byte limits pass, and its normalized section names are unambiguous.

For an editable legacy file, section order is the first occurrence of each trimmed group name. Every bookmark is appended to its group's section in original file-relative order even when occurrences of that group were noncontiguous. The optional/missing group becomes `Bookmarks`. Opening, retrying, canceling, or loading this conversion does not change source bytes. The first successful save of a changed draft writes `BookmarkDocumentV1` atomically.

An invalid, ambiguous, or excessive legacy file never becomes a partial editing base. The editor receives a safe host-configuration error and stays read-only. The ordinary dashboard retains the established safe behavior: an individually invalid but otherwise bounded legacy array can still produce its fresh partial envelope and `invalidEntryCount`; malformed, structurally excessive, unreadable, or invalid versioned content retains the previous display envelope as stale, or returns the existing unavailable error when no last-good value exists.

### Shared display contracts

All weather, eBird, llmdash, location, preference, issue, metadata, and snapshot contracts remain version `1`. `Bookmark`, including `id`, `group`, `name`, `url`, and `order`, also remains unchanged.

`BookmarksSummary` gains one additive field:

```ts
type BookmarksSummary = {
  sections: string[]       // ordered, unique section names, including empty sections
  bookmarks: Bookmark[]    // depth-first display projection; existing clients keep using this
  invalidEntryCount: number
}
```

Every new live bookmark envelope includes `sections`. Each bookmark's `group` occurs exactly once in `sections`; for a valid versioned document, bookmarks are contiguous in section/depth-first order. New client runtime validation synthesizes `sections` from first-seen `bookmark.group` values only when hydrating an older otherwise-valid `homedash.cache.bookmarks.v1` snapshot that lacks the additive field, then reparses the migrated value through the current envelope schema. Both current and migrated snapshots enforce 20 sections, 50 bookmarks per section, 100 bookmarks total, 2,048-code-point URLs, and lowercase 16-hex favicon IDs. The snapshot key and envelope `schemaVersion: 1` do not change. This compatibility path cannot invent empty legacy sections, because no earlier contract represented them.

Dawn and Dense render `sections` in order and select each section's bookmarks from the flat projection. A named empty section renders its heading and “No bookmarks”; an empty `sections` array renders the overall no-bookmarks state. `invalidEntryCount` and prior issue behavior remain available only for compatible legacy dashboard reads; a saved V1 document always has zero invalid entries.

### Editable API contracts

The editor uses exactly one same-origin resource with no query string:

| Route | Contract |
|---|---|
| `GET /api/bookmarks/document` | Freshly read, fully validated editing base. It never uses the browser snapshot, never serves a stale last-good document as editable, and never migrates the file. |
| `PUT /api/bookmarks/document` | Serialized compare-and-swap replacement of one complete candidate. There are no per-section or per-bookmark mutation routes. |

Both successful operations return `200`, `Content-Type: application/json`, `Cache-Control: no-store`, the existing security headers, and this strict shape:

```ts
type BookmarkDocumentResponse = {
  schemaVersion: 1
  revision: `sha256:${string}`
  document: BookmarkDocumentV1
  display: BookmarksEnvelope // complete server projection, including data.sections
}
```

The GET response's `display` is editing context only and must not replace the currently rendered dashboard. The PUT response's `display` is the authoritative confirmed-save value and avoids asking the browser to reproduce server-generated IDs or metadata.

The replacement request is strict JSON:

```ts
type ReplaceBookmarkDocumentRequest = {
  schemaVersion: 1
  baseRevision: `sha256:${string}`
  document: BookmarkDocumentV1
}
```

The route accepts only `application/json` (an optional charset is allowed), applies a route-specific 65,536-byte body limit before JSON parsing, and rejects compressed request bodies. The browser sends `X-Homedash-Bookmark-Write: 1`. CORS remains disabled; preflight never grants another origin access. Both GET and PUT require the raw HTTP `Host` to match the host/port of one exact configured origin. Any supplied `Origin` must be canonical, configured, and match that raw Host; any supplied `Sec-Fetch-Site` must be `same-origin`. `X-Forwarded-Host` and `X-Forwarded-Proto` never authorize access. The installer configures the exact direct-loopback and installed Tailscale HTTPS origins, so DNS-rebinding hosts and spoofed loopback forwarding headers are rejected before document reads or body use.

All editor failures use a non-reflecting JSON body; values, URLs, paths, request fragments, stacks, and filesystem details are never included:

```ts
type BookmarkDocumentErrorResponse = {
  schemaVersion: 1
  code:
    | 'bookmark-request-invalid'
    | 'bookmark-request-forbidden'
    | 'bookmark-request-too-large'
    | 'bookmark-media-type-unsupported'
    | 'bookmark-document-invalid'
    | 'bookmark-revision-conflict'
    | 'bookmark-source-invalid'
    | 'bookmark-source-unavailable'
    | 'bookmark-write-failed'
  message: string            // safe, actionable, at most 240 characters
  retryable: boolean
  fieldErrors?: Array<{      // at most 128 public errors
    path: string             // known RFC 6901 pointer into /document; at most 160 characters
    code:
      | 'required'
      | 'too-long'
      | 'control-character'
      | 'duplicate'
      | 'invalid-url'
      | 'too-many'
      | 'unknown-property'
      | 'unsupported-version'
    message: string          // safe, at most 160 characters
  }>
}
```

Status mapping is exact: malformed/structurally invalid wrappers are `400`; forbidden-origin/marker requests `403`; oversized bodies `413`; unsupported media `415`; candidate validation failures `422` with all applicable field errors (duplicates annotate every conflicting path); revision conflicts `409`; a newly invalid source at compare time `409`; unreadable source or write/durability failures `503`. Every error has `Cache-Control: no-store`. Fastify framework errors in this namespace are translated to this contract rather than its default body. Unsupported methods and query-bearing document requests return a non-reflecting `404` or `405` with no mutation and no CORS allowance.

### Serialized compare-and-swap save

`BookmarkService` owns a FIFO mutex covering every source observation that can replace in-memory accepted bookmark state and every save. Candidate request parsing/canonicalization may happen before entering it; no rejected candidate is retained after the request completes.

Inside the mutex, PUT performs these steps in order:

1. Open the target once read-only with no-follow semantics, require a same-handle regular file, read at most 65,537 bytes, verify stable same-handle metadata plus current path identity, then parse, validate, canonicalize, and hash it; do not use the mtime shortcut or prior last-good value for CAS.
2. If the current source is not a fully editable legacy/V1 document, return `bookmark-source-invalid` or `bookmark-source-unavailable` without writing.
3. Canonicalize the candidate independently. If the candidate revision already equals the current revision, return the current successful response even when `baseRevision` differs. This is the idempotent reconciliation path for a response lost after commit; it performs no write.
4. Otherwise compare `baseRevision` to the freshly computed current revision. A mismatch returns `bookmark-revision-conflict` and neither current content nor the draft is echoed.
5. Serialize the candidate to canonical disk bytes, create and sync a same-directory temporary file, then re-read and re-hash the target immediately before replacement. If its semantic revision changed, remove the temp file and return conflict.
6. Atomically rename the temp file over the configured target, sync the containing directory where supported, and freshly read/validate the resulting target. Do not acknowledge success until it equals the candidate canonical document.
7. Only after verification, replace the service's current/last-good display state, invalidate obsolete favicon IDs, and return the complete new response.

All application saves are linearized by the mutex, so at most one candidate based on a given revision can write. An uncoordinated host editor cannot participate in the application mutex; the fresh read plus immediate pre-rename semantic recheck closes the portable check window as far as Node on Linux/macOS permits. There is no cross-platform conditional-rename primitive, so a host process that overwrites the file in the final check-to-rename interval can still race. Host-side edits should themselves use atomic rename and should not be made during an in-app save. This residual filesystem limitation is explicit rather than hidden by mtime-based claims.

### Crash-safe atomic file replacement

The configured target must already exist as a regular non-symlink file and its parent directory must be writable by the service. Every source observation opens the target once with `O_RDONLY | O_NOFOLLOW` where available, checks the descriptor with `fstat`, reads no more than the 65,536-byte maximum plus one detection byte from that descriptor, and verifies stable descriptor metadata and post-open path identity before parsing. The handle supplies `sourceUpdatedAt` and closes in `finally`. Save never follows a target symlink and never creates a missing target from a stale browser draft.

- The temp file is in the target's directory so `rename` stays on one filesystem. Its reserved name is `.<basename>.homedash-<pid>-<randomUUID>.tmp`.
- Open it with exclusive create/write and no-follow flags where the platform exposes them, explicit mode `0o600`, and the service's existing `UMask=0077` defense in depth. Write all canonical bytes, call `FileHandle.sync()`, and close it before rename.
- `rename(temp, target)` is the only target replacement. Never truncate or write the target in place. After rename, open the parent directory read-only and call `sync()` on platforms that support directory fsync. Node/macOS `EINVAL` or `ENOTSUP` for directory sync is recorded as unsupported and followed by the authoritative reread; other directory-sync failures return the ambiguous `bookmark-write-failed` response so the client reconciles before claiming success.
- A `finally` block closes handles and unlinks the exact temp path on every pre-rename failure. Reserved leftover temp files from process death are ignored by readers and may be removed best-effort on startup only when they are regular files owned by the service user; cleanup failure never touches or invalidates the target.
- Failure before rename leaves the prior target intact. Failure after rename may mean the new document is already authoritative, so the service never attempts a compensating overwrite; it returns/propagates an ambiguous failure and lets the response-loss reconciliation rule establish the truth.

The deployment sandbox must allow writes and same-directory temp creation only in the resolved `BOOKMARKS_PATH` parent while keeping `.env` and the rest of the home directory read-only. New installs use a dedicated `${XDG_STATE_HOME:-$HOME/.local/state}/homedash/bookmarks` directory at mode `0700` and a `0600` bookmark file. The installer rejects broad or sensitive writable parents, symlink files, and unrelated sibling files in custom state directories. It preserves existing regular files in dedicated safe directories and the prior narrow `config/bookmarks.json` location. The generated systemd unit retains `ProtectHome=read-only` and adds its safely escaped `ReadWritePaths=` entry only after that validation.

### Last-good state and favicon invalidation

The service keeps two related concepts:

- `lastGoodDisplay`: the latest displayable bookmark envelope. A failed/malformed reread returns it as stale exactly as before and never clears its registry.
- `currentEditable`: the canonical document/revision from the latest fully valid fresh read. It is returned only when the current source bytes from that same observation are editable; an old value is never offered as a save base after a read failure.

An accepted fresh legacy partial envelope may update `lastGoodDisplay`, but because invalid entries were omitted it cannot update `currentEditable`. A failed save never mutates either object. A verified save replaces both atomically in memory. Ordinary GET, refresh, page-load, and favicon membership observations use the same mutex, so an older read cannot complete after a save and regress the registry.

Whenever a verified save or valid direct host change replaces the accepted registry, compare old and new `{id, url}` memberships. Call the existing bounded favicon invalidation for every old ID that no longer maps to the same URL. Failed reads do not invalidate because the prior accepted registry remains eligible. Favicon retrieval still performs current-membership lookup before cache use; cache/in-flight state stays bounded, process-only, and irrelevant to save success.

### Client snapshot and confirmed-save boundary

Every closed-to-open transition performs a fresh GET and stores its response only in dialog memory as `baselineDocument`, `baseRevision`, and a separately keyed draft. UI-only keys used for React focus/reorder stability are never serialized. Dirty state compares canonicalized draft content with the baseline document; presentation preference changes are excluded.

The editor uses a fixed eight-second client attempt timeout for document GET/PUT without changing `UPSTREAM_TIMEOUT_MS`. Aborting a PUT does not imply the server stopped; after any transport failure once a PUT may have been dispatched, the client performs one fresh document GET:

- If the returned canonical document equals the canonical draft, the save is confirmed from that response.
- If its revision differs from the base and content differs from the draft, enter the stale conflict flow while preserving the draft.
- If it still equals the base, show a retryable save failure. If reconciliation also fails, report an unknown outcome and retain the draft; a later retry is safe because candidate-equals-current succeeds idempotently.

Only a fully schema-validated successful PUT or matching reconciliation response crosses the confirmed-save boundary. At that point `useDashboardData` accepts exactly `response.display` for the bookmarks widget, replaces no other widget state, and best-effort writes that same envelope to `homedash.cache.bookmarks.v1`. Snapshot refusal does not roll back the in-memory or server save. The dialog then updates its baseline/revision, closes, returns focus, and announces “Bookmarks saved.” A GET used merely to open/retry the editor never updates dashboard state or the snapshot.

Other devices receive the new document only through their ordinary bookmark refresh, global refresh, or reload. No WebSocket, polling loop, service worker, Cache Storage record, local/session storage draft, or cross-device preference synchronization is added.

### Cumulative routes and caches

All prior routes remain: `/healthz`, weather, the version-1 bookmark widget envelope, eBird and llmdash summaries, fixed launch routes, static fallback, Kagi browser navigation, and the current-ID favicon resource. The document resource is classified before the favicon namespace so its strict JSON errors do not become favicon's deliberately empty `404`. The CSP remains `img-src 'self' data:` and CORS remains disabled.

Existing weather, SnowRaven/eBird, llmdash, browser snapshot, and favicon cache TTL/concurrency/deadline contracts do not change. Bookmark display caching changes only in that accepted envelopes now also carry ordered `sections`; it remains keyed/observed from the host file and retains last-good data after a failed reread.

## Changes in This Feature

### Added

- Strict `BookmarkDocumentV1`, canonicalization, content revision, and ordered empty-section representation.
- Additive `BookmarksSummary.sections` with backward normalization for existing V1 browser snapshots.
- Exact configured-Host/origin `GET`/`PUT /api/bookmarks/document` contracts and bounded, non-reflecting editor-specific errors.
- One BookmarkService file-operation mutex, semantic compare-and-swap replacement, same-directory atomic writer, verification, and ambiguous-result reconciliation.
- Memory-only client draft/baseline/revision state and a confirmed-save-only dashboard/snapshot replacement hook.
- Focused migration, validation, conflict, atomic-failure, empty-state, favicon-invalidation, API-boundary, and client reconciliation tests.

### Modified

- **Durable bookmark file:** originally only a flat ordered array read by the host; now also accepts and, on successful in-app save, writes the strict V1 section document. This approved product modification enables empty sections and in-app ordering. The primary risk is that an older binary cannot read a migrated file.
- **Bookmark service:** originally a read/mtime/last-good registry; now separates display last-good from a fresh editable base and serializes observations and writes. Existing partial-legacy dashboard behavior is retained, but partial data is never editable.
- **Bookmark display envelope:** originally only a flat list and invalid count; now adds ordered section names while retaining the old fields and storage key.
- **Favicon lifecycle:** current-membership enforcement remains, with explicit invalidation after accepted registry replacement so removed or changed bookmarks cannot inherit old process cache state.
- **Deployment file permissions:** the service's otherwise read-only home sandbox gains write access only to a validated dedicated or preserved-safe bookmark parent so same-directory atomic replacement is possible.

### Unchanged

- No database, ORM, migration files, account model, server-side presentation preference, history table, audit record, backup collection, or autosave exists.
- Weather, eBird, llmdash, moon-phase, location, Kagi, launch, issue/meta, source-isolation, refresh, privacy, and upstream deadline contracts stay unchanged.
- `Bookmark` fields and the native same-tab HTTP(S) link contract remain; favicon failures remain cosmetic.
- `homedash.preferences.v1`, `homedash.location.v1`, every `homedash.cache.<widget>.v1` key, loopback binding, Tailscale boundary, security headers, and browser CSP remain.

## Migration Plan

1. Add the shared strict document/request/response/error schemas, canonicalization helpers, `BookmarksSummary.sections`, and old-snapshot normalization tests.
2. Refactor `BookmarkService` behind one serialized operation boundary; add bounded legacy/V1 reads, separate display/editable state, canonical revisions, registry-diff callbacks, and exhaustive unit fixtures before enabling writes.
3. Add the atomic writer with injected filesystem seams and prove failures at create, write, file sync, pre-rename compare, rename, directory sync, and post-rename verification leave either the complete prior or complete new target and never update last-good prematurely.
4. Register the exact document routes, configured Host/origin allowlist, route-specific body limit, write-marker/media checks, safe framework-error translation, CAS/idempotent response behavior, and favicon-namespace exemption.
5. Add the in-memory settings draft and client API flow. Connect successful response validation to the bookmark-only dashboard/snapshot replacement boundary; add conflict and ambiguous-response reconciliation before visual work.
6. Update both renderers to consume ordered section names/empty sections, then implement the Designer's accessible settings dialog and explicit move controls without changing the normal closed-dashboard data flow.
7. Change only the example bookmark file to V1 for new installs, place new state in a dedicated `0700` directory, preserve existing safe configured files, and update the generated service allowlist for the validated bookmark parent. Run legacy files in place; there is no startup or read-time rewrite.
8. Run the complete static, unit, integration, accessibility, 360×800/1440×900 browser, favicon, cache, privacy, and atomic fault-injection suites before the bundle deployment gate.

Rollback is format-aware. Before any successful in-app save, reverting code is safe because legacy source bytes were never touched. After migration, do not deploy an older reader by itself. Prefer retaining the V1 reader while reverting the dialog; if a full older-binary rollback is required, first use a validated offline converter to atomically flatten sections in section/bookmark order to legacy `{group,name,url}` entries. Empty sections cannot survive that downgrade and require explicit operator acknowledgement. No automatic downgrade or backup history is promised; the installer and uninstaller continue preserving the configured bookmark file according to their existing scope.

## Design Decisions

1. **One file remains the authority.** Browser drafts and snapshots never compete with `BOOKMARKS_PATH`; a database would add ownership and migration complexity without helping the single-owner workflow.
2. **The durable and API versions are independent of widget version 1.** `BookmarkDocumentV1` can evolve without changing unrelated widget envelopes; the additive section list preserves existing bookmark snapshot compatibility.
3. **Section order is explicit, bookmark compatibility stays flat.** The durable nested structure can represent empty sections, while the additive display projection leaves shipped `Bookmark` consumers and favicon IDs usable.
4. **Revisions represent semantic editable content.** Hashing canonical data rejects meaningful stale writes without treating chmod, mtime, JSON formatting, or object-key order as edits.
5. **Whole-document CAS is the only mutation.** It matches staged Save/Cancel behavior and keeps validation, ordering, persistence, and in-memory publication atomic.
6. **Exact-match reconciliation is success, not conflict.** It makes a retry safe when the original response was lost without introducing force-overwrite or merge behavior.
7. **Last-good display data is not an editing base.** Resilience for the dashboard must not authorize overwriting a newer, missing, or invalid host file.
8. **Write durability precedes publication.** The service updates last-good state, favicon eligibility, and the client only after rename and authoritative reread; ambiguous post-rename failures reconcile instead of pretending rollback.
9. **Legacy migration is save-time only.** Compatibility is automatic on read, but durable conversion occurs only through a validated, user-initiated atomic replacement.
10. **The filesystem race is bounded honestly.** In-process saves are linearizable; semantic pre-rename recheck detects practical direct-edit races, while the narrow uncoordinated host check-to-rename interval remains a documented portable-filesystem limitation.
