import * as Dialog from '@radix-ui/react-dialog'
import * as ToggleGroup from '@radix-ui/react-toggle-group'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import {
  BOOKMARK_DOCUMENT_MAX_BYTES,
  BOOKMARK_SECTION_LIMIT,
  BOOKMARK_TOTAL_LIMIT,
  BOOKMARKS_PER_SECTION_LIMIT,
  canonicalBookmarkDocument,
  validateBookmarkDocument,
  type BookmarkDocumentFieldError,
  type BookmarkDocumentV1,
} from '../shared/bookmarkDocument'
import type {
  BookmarkDocumentResponse,
  BookmarksEnvelope,
  DevicePreferences,
  ReplaceBookmarkDocumentRequest,
} from '../shared/contracts'
import {
  BookmarkApiError,
  getBookmarkDocument,
  putBookmarkDocument,
} from '../lib/bookmarkDocumentApi'

interface DraftBookmark {
  key: string
  name: string
  url: string
}

interface DraftSection {
  key: string
  name: string
  bookmarks: DraftBookmark[]
}

type EditorState = 'loading' | 'loaded' | 'error' | 'conflict'
type Confirmation =
  | { kind: 'discard' }
  | { kind: 'reload' }
  | { kind: 'remove-section'; sectionIndex: number; name: string; count: number }

let keySequence = 0
function draftKey(prefix: string) {
  keySequence += 1
  return `${prefix}-${keySequence}`
}

function toDraft(document: BookmarkDocumentV1): DraftSection[] {
  return document.sections.map((section) => ({
    key: draftKey('section'),
    name: section.name,
    bookmarks: section.bookmarks.map((bookmark) => ({
      key: draftKey('bookmark'),
      name: bookmark.name,
      url: bookmark.url,
    })),
  }))
}

function fromDraft(draft: DraftSection[]): BookmarkDocumentV1 {
  return {
    schemaVersion: 1,
    sections: draft.map((section) => ({
      name: section.name,
      bookmarks: section.bookmarks.map((bookmark) => ({
        name: bookmark.name,
        url: bookmark.url,
      })),
    })),
  }
}

function errorMap(errors: BookmarkDocumentFieldError[]) {
  const map = new Map<string, BookmarkDocumentFieldError>()
  for (const error of errors) if (!map.has(error.path)) map.set(error.path, error)
  return map
}

function ArrowIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d={direction === 'up' ? 'M12 19V5m-6 6 6-6 6 6' : 'M12 5v14m6-6-6 6-6-6'} />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerRef: RefObject<HTMLButtonElement | null>
  preferences: DevicePreferences
  onPreferences: (preferences: DevicePreferences) => void
  onSaved: (display: BookmarksEnvelope) => boolean
  onAnnounce: (message: string) => void
}

export function SettingsDialog({
  open,
  onOpenChange,
  triggerRef,
  preferences,
  onPreferences,
  onSaved,
  onAnnounce,
}: SettingsDialogProps) {
  const [editorState, setEditorState] = useState<EditorState>('loading')
  const [baseline, setBaseline] = useState<BookmarkDocumentV1 | null>(null)
  const [baseRevision, setBaseRevision] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftSection[]>([])
  const [saving, setSaving] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [serverErrors, setServerErrors] = useState<BookmarkDocumentFieldError[]>([])
  const [touched, setTouched] = useState<Set<string>>(() => new Set())
  const [submitted, setSubmitted] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const focusAfterRender = useRef<string | null>(null)
  const focusFrame = useRef<number | null>(null)
  const confirmationOrigin = useRef<HTMLElement | null>(null)
  const errorSummaryRef = useRef<HTMLDivElement>(null)

  const draftDocument = useMemo(() => fromDraft(draft), [draft])
  const validation = useMemo(() => validateBookmarkDocument(draftDocument), [draftDocument])
  const allErrors = useMemo(() => {
    const errors = validation.success ? [] : [...validation.fieldErrors]
    if (validation.success && baseRevision) {
      const request: ReplaceBookmarkDocumentRequest = {
        schemaVersion: 1,
        baseRevision,
        document: validation.document,
      }
      if (
        new TextEncoder().encode(JSON.stringify(request)).byteLength > BOOKMARK_DOCUMENT_MAX_BYTES
      ) {
        errors.push({
          path: '/document',
          code: 'too-many',
          message: 'This bookmark list is too large to save. Shorten some names or addresses.',
        })
      }
    }
    return [...errors, ...serverErrors]
  }, [baseRevision, serverErrors, validation])
  const errorsByPath = useMemo(() => errorMap(allErrors), [allErrors])
  const dirty = useMemo(
    () =>
      Boolean(
        baseline &&
        canonicalBookmarkDocument(draftDocument) !== canonicalBookmarkDocument(baseline),
      ),
    [baseline, draftDocument],
  )
  const errorCount = new Set(allErrors.map((error) => error.path)).size
  const showSummary =
    errorCount > 0 &&
    (submitted || touched.size > 0 || allErrors.some((error) => error.path === '/document'))

  const closeWindow = useCallback(() => {
    onOpenChange(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }))
  }, [onOpenChange, triggerRef])

  const loadLatest = useCallback(async () => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setEditorState('loading')
    setRequestError('')
    setServerErrors([])
    setSubmitted(false)
    setTouched(new Set())
    try {
      const response = await getBookmarkDocument(controller.signal)
      if (requestRef.current !== controller) return
      setBaseline(response.document)
      setBaseRevision(response.revision)
      setDraft(toDraft(response.document))
      setEditorState('loaded')
    } catch (error) {
      if (requestRef.current !== controller || controller.signal.aborted) return
      setBaseline(null)
      setBaseRevision(null)
      setDraft([])
      setEditorState('error')
      setRequestError(
        error instanceof BookmarkApiError
          ? error.message
          : 'Saved bookmarks could not be opened. Try again.',
      )
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!open) return
    let active = true
    void Promise.resolve().then(() => {
      if (active) void loadLatest()
    })
    return () => {
      active = false
      requestRef.current?.abort()
      requestRef.current = null
      setConfirmation(null)
      setSaving(false)
    }
  }, [loadLatest, open])

  useLayoutEffect(() => {
    const target = focusAfterRender.current
    if (!target || confirmation) return
    focusAfterRender.current = null
    if (focusFrame.current !== null) window.cancelAnimationFrame(focusFrame.current)
    focusFrame.current = window.requestAnimationFrame(() => {
      focusFrame.current = null
      document.getElementById(target)?.focus({ preventScroll: true })
    })
    return () => {
      if (focusFrame.current !== null) window.cancelAnimationFrame(focusFrame.current)
      focusFrame.current = null
    }
  }, [confirmation, draft])

  const requestClose = useCallback(() => {
    if (saving) return
    if (dirty) {
      confirmationOrigin.current = document.activeElement as HTMLElement | null
      setConfirmation({ kind: 'discard' })
      return
    }
    closeWindow()
  }, [closeWindow, dirty, saving])

  const completeSave = useCallback(
    (response: BookmarkDocumentResponse) => {
      setBaseline(response.document)
      setBaseRevision(response.revision)
      setDraft(toDraft(response.document))
      onSaved(response.display)
      setSaving(false)
      closeWindow()
      onAnnounce('Bookmarks saved.')
    },
    [closeWindow, onAnnounce, onSaved],
  )

  const reconcileSave = useCallback(
    async (candidate: BookmarkDocumentV1, revision: string, controller: AbortController) => {
      try {
        const current = await getBookmarkDocument(controller.signal)
        if (canonicalBookmarkDocument(current.document) === canonicalBookmarkDocument(candidate)) {
          completeSave(current)
          return
        }
        if (current.revision !== revision) {
          setEditorState('conflict')
          setRequestError('')
          onAnnounce('Saved bookmarks changed elsewhere.')
          return
        }
        setRequestError('Bookmarks were not saved. Check your connection and try again.')
      } catch {
        setRequestError(
          'The save outcome could not be confirmed. Keep this draft open and try again.',
        )
      }
    },
    [completeSave, onAnnounce],
  )

  const save = useCallback(async () => {
    setSubmitted(true)
    setServerErrors([])
    setRequestError('')
    if (!validation.success || !baseRevision || !dirty || editorState !== 'loaded' || saving) {
      const first = allErrors[0]
      window.requestAnimationFrame(() => {
        const field = first
          ? document.querySelector<HTMLElement>(`[data-field-path="${first.path}"]`)
          : null
        ;(field ?? errorSummaryRef.current)?.focus()
      })
      if (errorCount) {
        onAnnounce(
          `${errorCount} ${errorCount === 1 ? 'field needs' : 'fields need'} attention before saving.`,
        )
      }
      return
    }
    const candidate = validation.document
    const request: ReplaceBookmarkDocumentRequest = {
      schemaVersion: 1,
      baseRevision,
      document: candidate,
    }
    if (
      new TextEncoder().encode(JSON.stringify(request)).byteLength > BOOKMARK_DOCUMENT_MAX_BYTES
    ) {
      return
    }

    const controller = new AbortController()
    requestRef.current = controller
    setSaving(true)
    onAnnounce('Saving bookmarks…')
    try {
      const response = await putBookmarkDocument(request, controller.signal)
      if (requestRef.current === controller) completeSave(response)
    } catch (error) {
      if (requestRef.current !== controller) return
      if (!(error instanceof BookmarkApiError) || error.body.code === 'bookmark-write-failed') {
        await reconcileSave(candidate, baseRevision, controller)
      } else if (
        error.body.code === 'bookmark-revision-conflict' ||
        error.body.code === 'bookmark-source-invalid'
      ) {
        setEditorState('conflict')
        onAnnounce('Saved bookmarks changed elsewhere.')
      } else if (error.body.code === 'bookmark-document-invalid') {
        setServerErrors(error.body.fieldErrors ?? [])
        setRequestError(error.message)
        window.requestAnimationFrame(() => errorSummaryRef.current?.focus())
      } else {
        setRequestError(error.message)
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null
      setSaving(false)
    }
  }, [
    allErrors,
    baseRevision,
    completeSave,
    dirty,
    editorState,
    errorCount,
    onAnnounce,
    reconcileSave,
    saving,
    validation,
  ])

  const markTouched = (path: string) => {
    setTouched((current) => new Set(current).add(path))
  }

  const mutate = (change: (current: DraftSection[]) => DraftSection[]) => {
    setDraft(change)
    setServerErrors([])
    setRequestError('')
  }

  const openConfirmation = (next: Confirmation) => {
    confirmationOrigin.current = document.activeElement as HTMLElement | null
    setConfirmation(next)
  }

  const confirm = () => {
    if (!confirmation) return
    if (confirmation.kind === 'discard') {
      setConfirmation(null)
      closeWindow()
      return
    }
    if (confirmation.kind === 'reload') {
      setConfirmation(null)
      void loadLatest()
      return
    }
    const { sectionIndex } = confirmation
    const remaining = draft.filter((_, index) => index !== sectionIndex)
    const next = remaining[Math.min(sectionIndex, remaining.length - 1)]
    focusAfterRender.current = next ? `section-${next.key}-name` : 'add-section'
    setConfirmation(null)
    mutate(() => remaining)
  }

  const cancelConfirmation = () => {
    setConfirmation(null)
    window.requestAnimationFrame(() => confirmationOrigin.current?.focus({ preventScroll: true }))
  }

  const visibleError = (path: string) => {
    const error = errorsByPath.get(path)
    return submitted || touched.has(path) || error?.code === 'duplicate' ? error : undefined
  }
  const totalBookmarks = draft.reduce((total, section) => total + section.bookmarks.length, 0)
  const canSave =
    editorState === 'loaded' && dirty && validation.success && errorCount === 0 && !saving

  const confirmationCopy = confirmation
    ? confirmation.kind === 'discard'
      ? {
          title: 'Discard bookmark changes?',
          description:
            'Your view and appearance choices will stay, but this bookmark draft will be cleared without saving.',
          action: 'Discard bookmark changes',
          cancel: 'Keep editing',
        }
      : confirmation.kind === 'reload'
        ? {
            title: 'Reload saved bookmarks?',
            description:
              'This will discard the complete draft and load the newer saved list. Your view and appearance choices will stay.',
            action: 'Discard draft and reload',
            cancel: 'Keep this draft open',
          }
        : {
            title: `Remove “${confirmation.name || 'Untitled'}”?`,
            description: `Remove “${confirmation.name || 'Untitled'}” and its ${confirmation.count} ${confirmation.count === 1 ? 'bookmark' : 'bookmarks'} from this draft? Nothing changes for other devices until you save.`,
            action: 'Remove section',
            cancel: 'Keep section',
          }
    : null

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="settings-overlay" />
        <Dialog.Content
          className="settings-dialog"
          aria-label="Settings"
          aria-modal="true"
          aria-describedby="settings-description"
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            event.preventDefault()
            requestClose()
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            window.requestAnimationFrame(() => document.getElementById('settings-title')?.focus())
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            triggerRef.current?.focus({ preventScroll: true })
          }}
        >
          <header className="settings-header">
            <div>
              <Dialog.Title id="settings-title" tabIndex={-1}>
                Settings
              </Dialog.Title>
              <Dialog.Description id="settings-description">
                View and appearance stay on this browser. Saved bookmarks update homedash on every
                device connected through your tailnet.
              </Dialog.Description>
            </div>
            <button
              className="settings-close"
              type="button"
              onClick={requestClose}
              disabled={saving}
            >
              <CloseIcon />
              <span>Close</span>
            </button>
          </header>

          <div className="settings-body">
            <section className="browser-preferences" aria-labelledby="browser-settings-heading">
              <p className="settings-scope">Only this browser</p>
              <h2 id="browser-settings-heading">This browser</h2>
              <p>Changes apply immediately and never join your shared bookmark draft.</p>

              <div className="preference-group">
                <h3>Display</h3>
                <ToggleGroup.Root
                  className="settings-toggle-group"
                  type="single"
                  value={preferences.mode}
                  aria-label="Display"
                  onValueChange={(mode) => {
                    if (mode === 'dawn' || mode === 'dense') {
                      onPreferences({ ...preferences, mode })
                    }
                  }}
                >
                  <ToggleGroup.Item value="dawn">Dawn</ToggleGroup.Item>
                  <ToggleGroup.Item value="dense">Dense</ToggleGroup.Item>
                </ToggleGroup.Root>
              </div>

              <div className="preference-group">
                <h3>Appearance</h3>
                <ToggleGroup.Root
                  className="settings-toggle-group"
                  type="single"
                  value={preferences.appearance}
                  aria-label="Appearance"
                  onValueChange={(appearance) => {
                    if (
                      appearance === 'system' ||
                      appearance === 'light' ||
                      appearance === 'dark'
                    ) {
                      onPreferences({ ...preferences, appearance })
                    }
                  }}
                >
                  <ToggleGroup.Item value="system">System</ToggleGroup.Item>
                  <ToggleGroup.Item value="light">Light</ToggleGroup.Item>
                  <ToggleGroup.Item value="dark">Dark</ToggleGroup.Item>
                </ToggleGroup.Root>
              </div>
            </section>

            <section className="bookmark-editor" aria-labelledby="shared-bookmarks-heading">
              <div className="editor-intro">
                <div>
                  <p className="settings-scope">Every tailnet device</p>
                  <h2 id="shared-bookmarks-heading">Shared bookmarks</h2>
                </div>
                <p>Save once to replace the shared ordered list.</p>
              </div>

              {editorState === 'loading' && (
                <div className="editor-load-state" role="status">
                  <h3>Reading the latest saved bookmarks…</h3>
                  <p>This browser settings stay available while the shared list loads.</p>
                  <span />
                  <span />
                  <span />
                </div>
              )}

              {editorState === 'error' && (
                <div className="editor-load-state editor-read-error">
                  <h3>Saved bookmarks could not be opened</h3>
                  <p>
                    {requestError || 'Try again, or check the bookmark file on the homedash host.'}
                  </p>
                  <button type="button" className="text-action" onClick={() => void loadLatest()}>
                    Retry
                  </button>
                </div>
              )}

              {editorState === 'conflict' && (
                <div className="editor-status is-error" role="alert">
                  <strong>Saved bookmarks changed elsewhere</strong>
                  <span>
                    Your draft is still here, but it cannot be saved against the older list.
                  </span>
                  <div className="status-actions">
                    <button
                      type="button"
                      className="text-action"
                      onClick={() => openConfirmation({ kind: 'reload' })}
                    >
                      Reload saved bookmarks
                    </button>
                    <button
                      type="button"
                      className="text-action"
                      onClick={() => {
                        setRequestError('Draft kept open. Reload when you are ready to replace it.')
                        onAnnounce('Draft kept open.')
                      }}
                    >
                      Keep this draft open
                    </button>
                  </div>
                </div>
              )}

              {(editorState === 'loaded' || editorState === 'conflict') && (
                <>
                  {requestError && (
                    <div className="editor-status is-error" role="alert">
                      {requestError}
                    </div>
                  )}
                  {showSummary && (
                    <div
                      className="editor-error-summary"
                      role="alert"
                      tabIndex={-1}
                      ref={errorSummaryRef}
                    >
                      <strong>
                        {errorCount} {errorCount === 1 ? 'field needs' : 'fields need'} attention.
                      </strong>
                      <span>
                        Fix the marked {errorCount === 1 ? 'field' : 'fields'} before saving. Your
                        shared list has not changed.
                      </span>
                    </div>
                  )}

                  {!draft.length ? (
                    <div className="empty-editor">
                      <h3>No sections yet</h3>
                      <p>Add a section when you have somewhere new to go.</p>
                    </div>
                  ) : (
                    <div className="bookmark-section-list">
                      {draft.map((section, sectionIndex) => {
                        const sectionPath = `/document/sections/${sectionIndex}`
                        const sectionNamePath = `${sectionPath}/name`
                        const sectionError = visibleError(sectionNamePath)
                        return (
                          <section
                            className="bookmark-section-editor"
                            key={section.key}
                            aria-label={`Section ${section.name || 'untitled'}`}
                          >
                            <div className="section-editor-head">
                              <span className="section-order">
                                {String(sectionIndex + 1).padStart(2, '0')}
                              </span>
                              <label className="editor-field section-name-field">
                                <span>Section name</span>
                                <input
                                  id={`section-${section.key}-name`}
                                  data-field-path={sectionNamePath}
                                  value={section.name}
                                  aria-invalid={sectionError ? 'true' : undefined}
                                  aria-describedby={
                                    sectionError ? `section-${section.key}-name-error` : undefined
                                  }
                                  disabled={saving}
                                  onBlur={() => markTouched(sectionNamePath)}
                                  onChange={(event) =>
                                    mutate((current) =>
                                      current.map((item, index) =>
                                        index === sectionIndex
                                          ? { ...item, name: event.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                                {sectionError && (
                                  <span
                                    className="field-error"
                                    id={`section-${section.key}-name-error`}
                                  >
                                    {sectionError.message}
                                  </span>
                                )}
                              </label>
                              <div className="row-actions section-actions">
                                {(['up', 'down'] as const).map((direction) => (
                                  <button
                                    id={`section-${section.key}-move-${direction}`}
                                    className="small-action"
                                    type="button"
                                    key={direction}
                                    disabled={saving}
                                    aria-disabled={
                                      saving ||
                                      (direction === 'up'
                                        ? sectionIndex === 0
                                        : sectionIndex === draft.length - 1)
                                    }
                                    aria-label={`Move section ${section.name || 'untitled'} ${direction}`}
                                    onClick={() => {
                                      const target =
                                        direction === 'up' ? sectionIndex - 1 : sectionIndex + 1
                                      if (target < 0 || target >= draft.length) return
                                      focusAfterRender.current = `section-${section.key}-move-${direction}`
                                      mutate((current) => {
                                        const next = [...current]
                                        ;[next[sectionIndex], next[target]] = [
                                          next[target]!,
                                          next[sectionIndex]!,
                                        ]
                                        return next
                                      })
                                    }}
                                  >
                                    <ArrowIcon direction={direction} />
                                    <span>{direction === 'up' ? 'Move up' : 'Move down'}</span>
                                  </button>
                                ))}
                                <button
                                  className="small-action remove-action"
                                  type="button"
                                  disabled={saving}
                                  aria-label={`Remove section ${section.name || 'untitled'}`}
                                  onClick={() => {
                                    if (section.bookmarks.length) {
                                      openConfirmation({
                                        kind: 'remove-section',
                                        sectionIndex,
                                        name: section.name,
                                        count: section.bookmarks.length,
                                      })
                                      return
                                    }
                                    const remaining = draft.filter(
                                      (_, index) => index !== sectionIndex,
                                    )
                                    const next =
                                      remaining[Math.min(sectionIndex, remaining.length - 1)]
                                    focusAfterRender.current = next
                                      ? `section-${next.key}-name`
                                      : 'add-section'
                                    mutate(() => remaining)
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>

                            <div className="section-bookmarks">
                              {!section.bookmarks.length && (
                                <p className="empty-section-copy">
                                  No bookmarks in this section yet.
                                </p>
                              )}
                              {section.bookmarks.map((bookmark, bookmarkIndex) => {
                                const bookmarkPath = `${sectionPath}/bookmarks/${bookmarkIndex}`
                                const namePath = `${bookmarkPath}/name`
                                const urlPath = `${bookmarkPath}/url`
                                const nameError = visibleError(namePath)
                                const urlError = visibleError(urlPath)
                                return (
                                  <div className="bookmark-editor-row" key={bookmark.key}>
                                    <label className="editor-field">
                                      <span>Bookmark name</span>
                                      <input
                                        id={`bookmark-${bookmark.key}-name`}
                                        data-field-path={namePath}
                                        value={bookmark.name}
                                        aria-invalid={nameError ? 'true' : undefined}
                                        aria-describedby={
                                          nameError
                                            ? `bookmark-${bookmark.key}-name-error`
                                            : undefined
                                        }
                                        disabled={saving}
                                        onBlur={() => markTouched(namePath)}
                                        onChange={(event) =>
                                          mutate((current) =>
                                            current.map((item, index) =>
                                              index === sectionIndex
                                                ? {
                                                    ...item,
                                                    bookmarks: item.bookmarks.map(
                                                      (candidate, candidateIndex) =>
                                                        candidateIndex === bookmarkIndex
                                                          ? {
                                                              ...candidate,
                                                              name: event.target.value,
                                                            }
                                                          : candidate,
                                                    ),
                                                  }
                                                : item,
                                            ),
                                          )
                                        }
                                      />
                                      {nameError && (
                                        <span
                                          className="field-error"
                                          id={`bookmark-${bookmark.key}-name-error`}
                                        >
                                          {nameError.message}
                                        </span>
                                      )}
                                    </label>
                                    <label className="editor-field">
                                      <span>Address</span>
                                      <input
                                        id={`bookmark-${bookmark.key}-url`}
                                        type="url"
                                        inputMode="url"
                                        data-field-path={urlPath}
                                        value={bookmark.url}
                                        aria-invalid={urlError ? 'true' : undefined}
                                        aria-describedby={
                                          urlError
                                            ? `bookmark-${bookmark.key}-url-error`
                                            : undefined
                                        }
                                        disabled={saving}
                                        onBlur={() => markTouched(urlPath)}
                                        onChange={(event) =>
                                          mutate((current) =>
                                            current.map((item, index) =>
                                              index === sectionIndex
                                                ? {
                                                    ...item,
                                                    bookmarks: item.bookmarks.map(
                                                      (candidate, candidateIndex) =>
                                                        candidateIndex === bookmarkIndex
                                                          ? {
                                                              ...candidate,
                                                              url: event.target.value,
                                                            }
                                                          : candidate,
                                                    ),
                                                  }
                                                : item,
                                            ),
                                          )
                                        }
                                      />
                                      {urlError && (
                                        <span
                                          className="field-error"
                                          id={`bookmark-${bookmark.key}-url-error`}
                                        >
                                          {urlError.message}
                                        </span>
                                      )}
                                    </label>
                                    <div className="row-actions bookmark-actions">
                                      {(['up', 'down'] as const).map((direction) => (
                                        <button
                                          id={`bookmark-${bookmark.key}-move-${direction}`}
                                          className="small-action"
                                          type="button"
                                          key={direction}
                                          disabled={saving}
                                          aria-disabled={
                                            saving ||
                                            (direction === 'up'
                                              ? bookmarkIndex === 0
                                              : bookmarkIndex === section.bookmarks.length - 1)
                                          }
                                          aria-label={`Move bookmark ${bookmark.name || 'untitled'} ${direction}`}
                                          onClick={() => {
                                            const target =
                                              direction === 'up'
                                                ? bookmarkIndex - 1
                                                : bookmarkIndex + 1
                                            if (target < 0 || target >= section.bookmarks.length) {
                                              return
                                            }
                                            focusAfterRender.current = `bookmark-${bookmark.key}-move-${direction}`
                                            mutate((current) =>
                                              current.map((item, index) => {
                                                if (index !== sectionIndex) return item
                                                const bookmarks = [...item.bookmarks]
                                                ;[bookmarks[bookmarkIndex], bookmarks[target]] = [
                                                  bookmarks[target]!,
                                                  bookmarks[bookmarkIndex]!,
                                                ]
                                                return { ...item, bookmarks }
                                              }),
                                            )
                                          }}
                                        >
                                          <ArrowIcon direction={direction} />
                                          <span>
                                            {direction === 'up' ? 'Move up' : 'Move down'}
                                          </span>
                                        </button>
                                      ))}
                                      <button
                                        className="small-action remove-action"
                                        type="button"
                                        disabled={saving}
                                        aria-label={`Remove bookmark ${bookmark.name || 'untitled'} from ${section.name || 'untitled'}`}
                                        onClick={() => {
                                          const remaining = section.bookmarks.filter(
                                            (_, index) => index !== bookmarkIndex,
                                          )
                                          const next =
                                            remaining[Math.min(bookmarkIndex, remaining.length - 1)]
                                          focusAfterRender.current = next
                                            ? `bookmark-${next.key}-name`
                                            : `add-bookmark-${section.key}`
                                          mutate((current) =>
                                            current.map((item, index) =>
                                              index === sectionIndex
                                                ? { ...item, bookmarks: remaining }
                                                : item,
                                            ),
                                          )
                                        }}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            <div className="section-editor-tail">
                              <button
                                id={`add-bookmark-${section.key}`}
                                className="add-action"
                                type="button"
                                aria-label={`Add bookmark to ${section.name || 'untitled'}`}
                                aria-describedby={`add-bookmark-${section.key}-limit`}
                                disabled={
                                  saving ||
                                  section.bookmarks.length >= BOOKMARKS_PER_SECTION_LIMIT ||
                                  totalBookmarks >= BOOKMARK_TOTAL_LIMIT
                                }
                                onClick={() => {
                                  const bookmark: DraftBookmark = {
                                    key: draftKey('bookmark'),
                                    name: '',
                                    url: 'https://',
                                  }
                                  focusAfterRender.current = `bookmark-${bookmark.key}-name`
                                  mutate((current) =>
                                    current.map((item, index) =>
                                      index === sectionIndex
                                        ? { ...item, bookmarks: [...item.bookmarks, bookmark] }
                                        : item,
                                    ),
                                  )
                                }}
                              >
                                <PlusIcon /> Add bookmark
                              </button>
                              <span id={`add-bookmark-${section.key}-limit`}>
                                {section.bookmarks.length >= BOOKMARKS_PER_SECTION_LIMIT
                                  ? 'Section limit reached · 50 of 50 bookmarks'
                                  : totalBookmarks >= BOOKMARK_TOTAL_LIMIT
                                    ? 'Document limit reached · 100 of 100 bookmarks'
                                    : `${section.bookmarks.length} of 50 bookmarks`}
                              </span>
                            </div>
                          </section>
                        )
                      })}
                    </div>
                  )}

                  <div className="add-section-row">
                    <button
                      id="add-section"
                      className="add-action"
                      type="button"
                      aria-describedby="add-section-limit"
                      disabled={saving || draft.length >= BOOKMARK_SECTION_LIMIT}
                      onClick={() => {
                        const section: DraftSection = {
                          key: draftKey('section'),
                          name: '',
                          bookmarks: [],
                        }
                        focusAfterRender.current = `section-${section.key}-name`
                        mutate((current) => [...current, section])
                      }}
                    >
                      <PlusIcon /> Add section
                    </button>
                    <span id="add-section-limit">
                      {draft.length >= BOOKMARK_SECTION_LIMIT ? 'Section limit reached · ' : ''}
                      {draft.length} of 20 sections · {totalBookmarks} of 100 bookmarks
                    </span>
                  </div>
                </>
              )}
            </section>
          </div>

          <footer className="settings-footer">
            <p className={dirty ? 'is-dirty' : undefined} aria-live="polite">
              {saving
                ? 'Checking and replacing the shared bookmark list…'
                : dirty
                  ? 'Bookmark changes are staged on this device'
                  : 'Saved order · no bookmark changes'}
            </p>
            <div>
              <button
                type="button"
                className="cancel-action"
                onClick={requestClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`save-action ${saving ? 'is-saving' : ''}`}
                onClick={() => void save()}
                disabled={!canSave}
              >
                {saving && <span className="save-spinner" aria-hidden="true" />}
                {saving ? 'Saving…' : 'Save bookmarks'}
              </button>
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>

      <Dialog.Root
        open={Boolean(confirmation)}
        onOpenChange={(next) => {
          if (!next) cancelConfirmation()
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="confirmation-overlay" />
          <Dialog.Content
            className="confirmation-dialog"
            aria-modal="true"
            aria-describedby="confirmation-description"
            onPointerDownOutside={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => {
              event.preventDefault()
              cancelConfirmation()
            }}
          >
            <Dialog.Title>{confirmationCopy?.title}</Dialog.Title>
            <Dialog.Description id="confirmation-description">
              {confirmationCopy?.description}
            </Dialog.Description>
            <div className="confirmation-actions">
              <button type="button" className="cancel-action" onClick={cancelConfirmation}>
                {confirmationCopy?.cancel}
              </button>
              <button type="button" className="confirm-action" onClick={confirm}>
                {confirmationCopy?.action}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Dialog.Root>
  )
}
