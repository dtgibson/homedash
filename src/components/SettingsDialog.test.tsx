import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  BookmarkDocumentResponse,
  BookmarksEnvelope,
  DevicePreferences,
} from '../shared/contracts'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}))

vi.mock('../lib/bookmarkDocumentApi', () => {
  class BookmarkApiError extends Error {
    constructor(
      readonly status: number,
      readonly body: {
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
        message: string
        retryable: boolean
        fieldErrors?: Array<{
          path: string
          code:
            | 'required'
            | 'too-long'
            | 'control-character'
            | 'duplicate'
            | 'invalid-url'
            | 'too-many'
            | 'unknown-property'
            | 'unsupported-version'
          message: string
        }>
      },
    ) {
      super(body.message)
    }
  }

  class BookmarkTransportError extends Error {}

  return {
    BookmarkApiError,
    BookmarkTransportError,
    getBookmarkDocument: api.get,
    putBookmarkDocument: api.put,
  }
})

import { BookmarkApiError, BookmarkTransportError } from '../lib/bookmarkDocumentApi'
import { SettingsDialog } from './SettingsDialog'

const meta = {
  generatedAt: '2026-09-09T12:00:00.000Z',
  sourceUpdatedAt: '2026-09-09T12:00:00.000Z',
  freshness: 'fresh' as const,
  staleAfterMs: 86_400_000,
  issues: [],
}

function response(
  sections: BookmarkDocumentResponse['document']['sections'] = [
    {
      name: 'Daily',
      bookmarks: [
        { name: 'First', url: 'https://first.example/' },
        { name: 'Second', url: 'https://second.example/' },
      ],
    },
    { name: 'Projects', bookmarks: [{ name: 'Code', url: 'https://code.example/' }] },
  ],
  revisionCharacter = 'a',
): BookmarkDocumentResponse {
  let order = 0
  const bookmarks = sections.flatMap((section) =>
    section.bookmarks.map((bookmark) => {
      const value = {
        id: String(order).padStart(16, revisionCharacter).slice(-16),
        group: section.name,
        name: bookmark.name,
        url: bookmark.url,
        order,
      }
      order += 1
      return value
    }),
  )
  return {
    schemaVersion: 1,
    revision: `sha256:${revisionCharacter.repeat(64)}`,
    document: { schemaVersion: 1, sections },
    display: {
      schemaVersion: 1,
      data: { sections: sections.map((section) => section.name), bookmarks, invalidEntryCount: 0 },
      meta,
    },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

interface HarnessProps {
  onSaved?: (display: BookmarksEnvelope) => boolean
  onAnnounce?: (message: string) => void
}

function Harness({ onSaved = () => true, onAnnounce = () => undefined }: HarnessProps) {
  const [open, setOpen] = useState(false)
  const [preferences, setPreferences] = useState<DevicePreferences>({
    schemaVersion: 1,
    mode: 'dawn',
    appearance: 'system',
    targetSort: 'distance',
  })
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
        Settings
      </button>
      <output data-testid="preferences">
        {preferences.mode}:{preferences.appearance}
      </output>
      <SettingsDialog
        open={open}
        onOpenChange={setOpen}
        triggerRef={triggerRef}
        preferences={preferences}
        onPreferences={setPreferences}
        onSaved={onSaved}
        onAnnounce={onAnnounce}
      />
    </>
  )
}

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Settings' }))
  return screen.findByRole('dialog', { name: 'Settings' })
}

async function loadedSettings(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await openSettings(user)
  await within(dialog).findByDisplayValue('Daily')
  return dialog
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  api.get.mockResolvedValue(response())
  api.put.mockResolvedValue(response())
})

describe('SettingsDialog loading and browser preferences', () => {
  it('loads fresh editable data on every opening while browser preferences remain immediate', async () => {
    const firstRead = deferred<BookmarkDocumentResponse>()
    api.get.mockReset()
    api.get
      .mockReturnValueOnce(firstRead.promise)
      .mockResolvedValueOnce(response([{ name: 'Fresh', bookmarks: [] }], 'b'))
    const user = userEvent.setup()
    render(<Harness />)

    const dialog = await openSettings(user)
    await waitFor(() =>
      expect(within(dialog).getByRole('heading', { name: 'Settings' })).toHaveFocus(),
    )
    expect(within(dialog).getByText('Reading the latest saved bookmarks…')).toBeVisible()
    expect(within(dialog).getByRole('radio', { name: 'Dawn' })).toBeChecked()
    await user.click(within(dialog).getByRole('radio', { name: 'Dense' }))
    await user.click(within(dialog).getByRole('radio', { name: 'Dark' }))
    expect(screen.getByTestId('preferences')).toHaveTextContent('dense:dark')

    await act(async () => firstRead.resolve(response()))
    await within(dialog).findByDisplayValue('Daily')
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull())
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus()

    const reopened = await openSettings(user)
    expect(await within(reopened).findByDisplayValue('Fresh')).toBeVisible()
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('preferences')).toHaveTextContent('dense:dark')
  })

  it('keeps the dialog open with a safe retry when editable data cannot be read', async () => {
    api.get.mockRejectedValueOnce(
      new BookmarkApiError(409, {
        schemaVersion: 1,
        code: 'bookmark-source-invalid',
        message: 'The bookmark file is not valid for editing.',
        retryable: false,
      }),
    )
    const user = userEvent.setup()
    render(<Harness />)
    const dialog = await openSettings(user)

    expect(await within(dialog).findByText('Saved bookmarks could not be opened')).toBeVisible()
    expect(within(dialog).getByText('The bookmark file is not valid for editing.')).toBeVisible()
    expect(within(dialog).getByRole('radio', { name: 'Dawn' })).toBeEnabled()

    api.get.mockResolvedValueOnce(response([{ name: 'Recovered', bookmarks: [] }], 'b'))
    await user.click(within(dialog).getByRole('button', { name: 'Retry' }))
    expect(await within(dialog).findByDisplayValue('Recovered')).toBeVisible()
  })
})

describe('SettingsDialog draft editing and validation', () => {
  it('adds, reorders, and removes draft items with predictable focus', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const dialog = await loadedSettings(user)

    await user.click(within(dialog).getByRole('button', { name: 'Add section' }))
    const sectionNames = within(dialog).getAllByLabelText('Section name')
    const newSectionName = sectionNames.at(-1)!
    await waitFor(() => expect(newSectionName).toHaveFocus())
    await user.type(newSectionName, 'Reading')

    const reading = within(dialog).getByRole('region', { name: 'Section Reading' })
    await user.click(within(reading).getByRole('button', { name: 'Add bookmark to Reading' }))
    const newBookmarkName = within(reading).getByLabelText('Bookmark name')
    await waitFor(() => expect(newBookmarkName).toHaveFocus())
    await user.type(newBookmarkName, 'Longreads')
    const address = within(reading).getByLabelText('Address')
    await user.clear(address)
    await user.type(address, 'https://longreads.example/')

    const moveSection = within(dialog).getByRole('button', {
      name: 'Move section Reading up',
    })
    await user.click(moveSection)
    await waitFor(() => expect(moveSection).toHaveFocus())

    const daily = within(dialog).getByRole('region', { name: 'Section Daily' })
    const moveBookmark = within(daily).getByRole('button', {
      name: 'Move bookmark Second up',
    })
    await user.click(moveBookmark)
    await waitFor(() => expect(moveBookmark).toHaveFocus())
    expect(
      within(daily)
        .getAllByLabelText('Bookmark name')
        .map((input) => (input as HTMLInputElement).value),
    ).toEqual(['Second', 'First'])

    await user.click(
      within(reading).getByRole('button', {
        name: 'Remove bookmark Longreads from Reading',
      }),
    )
    await waitFor(() =>
      expect(
        within(reading).getByRole('button', { name: 'Add bookmark to Reading' }),
      ).toHaveFocus(),
    )
    expect(api.put).not.toHaveBeenCalled()
  })

  it('confirms non-empty section removal with its name and exact bookmark count', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const dialog = await loadedSettings(user)
    const daily = within(dialog).getByRole('region', { name: 'Section Daily' })
    const remove = within(daily).getByRole('button', { name: 'Remove section Daily' })

    await user.click(remove)
    const confirmation = screen.getByRole('dialog', { name: 'Remove “Daily”?' })
    expect(within(confirmation).getByText(/its 2 bookmarks from this draft/)).toBeVisible()
    await user.click(within(confirmation).getByRole('button', { name: 'Keep section' }))
    await waitFor(() => expect(remove).toHaveFocus())

    await user.click(remove)
    await user.click(
      within(screen.getByRole('dialog', { name: 'Remove “Daily”?' })).getByRole('button', {
        name: 'Remove section',
      }),
    )
    await waitFor(() => expect(within(dialog).getByDisplayValue('Projects')).toHaveFocus())
    expect(within(dialog).queryByRole('region', { name: 'Section Daily' })).toBeNull()
    expect(api.put).not.toHaveBeenCalled()
  })

  it('identifies both duplicate section fields and invalid URLs as editing completes', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const dialog = await loadedSettings(user)
    const sectionNames = within(dialog).getAllByLabelText('Section name')

    await user.clear(sectionNames[1]!)
    await user.type(sectionNames[1]!, ' daily ')
    await user.tab()

    await waitFor(() => {
      expect(sectionNames[0]).toHaveAttribute('aria-invalid', 'true')
      expect(sectionNames[1]).toHaveAttribute('aria-invalid', 'true')
    })
    expect(
      within(dialog).getAllByText('Use a different name; section names must be unique.'),
    ).toHaveLength(2)

    const daily = within(dialog).getByRole('region', { name: 'Section Daily' })
    const address = within(daily).getAllByLabelText('Address')[0]!
    await user.clear(address)
    await user.type(address, 'javascript:alert(1)')
    await user.tab()
    expect(await within(dialog).findByText(/3 fields need attention/)).toBeVisible()
    expect(address).toHaveAccessibleDescription(
      'Enter a complete http:// or https:// address without a password.',
    )
    expect(within(dialog).getByRole('button', { name: 'Save bookmarks' })).toBeDisabled()
    expect(api.put).not.toHaveBeenCalled()
  })

  it('disables capped add controls and gives each limit an accessible explanation', async () => {
    api.get.mockResolvedValueOnce(
      response(
        Array.from({ length: 20 }, (_, index) => ({
          name: `Section ${index + 1}`,
          bookmarks:
            index === 0
              ? Array.from({ length: 50 }, (_, bookmarkIndex) => ({
                  name: `Bookmark ${bookmarkIndex + 1}`,
                  url: `https://example.com/${bookmarkIndex + 1}`,
                }))
              : [],
        })),
      ),
    )
    const user = userEvent.setup()
    render(<Harness />)
    const dialog = await openSettings(user)
    await within(dialog).findByDisplayValue('Section 1')

    const addSection = within(dialog).getByRole('button', { name: 'Add section' })
    const first = within(dialog).getByRole('region', { name: 'Section Section 1' })
    const addBookmark = within(first).getByRole('button', {
      name: 'Add bookmark to Section 1',
    })
    expect(addSection).toBeDisabled()
    expect(addSection).toHaveAccessibleDescription(/Section limit reached/)
    expect(addBookmark).toBeDisabled()
    expect(addBookmark).toHaveAccessibleDescription('Section limit reached · 50 of 50 bookmarks')
  })
})

describe('SettingsDialog dismissal, save, and conflict behavior', () => {
  it('confirms dirty Escape dismissal, restores focus on keep, and stores no draft', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const dialog = await loadedSettings(user)
    const dailyName = within(dialog).getAllByLabelText('Section name')[0]!
    fireEvent.change(dailyName, { target: { value: 'Daily changed' } })
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Save bookmarks' })).toBeEnabled(),
    )
    await user.click(dailyName)

    await user.keyboard('{Escape}')
    const confirmation = await screen.findByRole('dialog', { name: 'Discard bookmark changes?' })
    expect(within(confirmation).getAllByRole('button')).toHaveLength(2)
    await user.click(within(confirmation).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(dailyName).toHaveFocus())

    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Discard bookmark changes?' })).getByRole(
        'button',
        { name: 'Discard bookmark changes' },
      ),
    )
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull())
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus()
    expect(localStorage).toHaveLength(0)
    expect(sessionStorage).toHaveLength(0)
    expect(api.put).not.toHaveBeenCalled()
  })

  it('does not treat browser-only preference changes as a dirty bookmark draft', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const dialog = await loadedSettings(user)
    await user.click(within(dialog).getByRole('radio', { name: 'Dense' }))
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull())
    expect(screen.queryByRole('dialog', { name: 'Discard bookmark changes?' })).toBeNull()
    expect(screen.getByTestId('preferences')).toHaveTextContent('dense:system')
  })

  it('locks bookmark dismissal and mutations while one save is pending, then confirms success', async () => {
    const pending = deferred<BookmarkDocumentResponse>()
    api.put.mockReturnValueOnce(pending.promise)
    const onSaved = vi.fn(() => true)
    const onAnnounce = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSaved={onSaved} onAnnounce={onAnnounce} />)
    const dialog = await loadedSettings(user)
    const dailyName = within(dialog).getAllByLabelText('Section name')[0]!
    await user.clear(dailyName)
    await user.type(dailyName, ' Later ')

    await user.click(within(dialog).getByRole('button', { name: 'Save bookmarks' }))
    expect(api.put).toHaveBeenCalledWith(
      expect.objectContaining({
        baseRevision: `sha256:${'a'.repeat(64)}`,
        document: expect.objectContaining({
          sections: expect.arrayContaining([expect.objectContaining({ name: 'Later' })]),
        }),
      }),
      expect.any(AbortSignal),
    )
    expect(within(dialog).getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(dailyName).toBeDisabled()
    expect(within(dialog).getByRole('radio', { name: 'Dark' })).toBeEnabled()
    expect(onAnnounce).toHaveBeenCalledWith('Saving bookmarks…')
    await user.keyboard('{Escape}')
    expect(within(dialog).getByRole('button', { name: 'Saving…' })).toBeVisible()

    const confirmed = response(
      [
        {
          name: 'Later',
          bookmarks: [
            { name: 'First', url: 'https://first.example/' },
            { name: 'Second', url: 'https://second.example/' },
          ],
        },
        { name: 'Projects', bookmarks: [{ name: 'Code', url: 'https://code.example/' }] },
      ],
      'b',
    )
    await act(async () => pending.resolve(confirmed))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull())
    expect(onSaved).toHaveBeenCalledWith(confirmed.display)
    expect(onAnnounce).toHaveBeenLastCalledWith('Bookmarks saved.')
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus()
  })

  it('preserves a stale draft and requires confirmation before reloading saved bookmarks', async () => {
    api.put.mockRejectedValueOnce(
      new BookmarkApiError(409, {
        schemaVersion: 1,
        code: 'bookmark-revision-conflict',
        message: 'Saved bookmarks changed elsewhere. Reload them before saving this draft.',
        retryable: false,
      }),
    )
    api.get
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response([{ name: 'Remote', bookmarks: [] }], 'b'))
    const onAnnounce = vi.fn()
    const user = userEvent.setup()
    render(<Harness onAnnounce={onAnnounce} />)
    const dialog = await loadedSettings(user)
    const name = within(dialog).getAllByLabelText('Section name')[0]!
    await user.clear(name)
    await user.type(name, 'Local draft')
    await user.click(within(dialog).getByRole('button', { name: 'Save bookmarks' }))

    expect(await within(dialog).findByText('Saved bookmarks changed elsewhere')).toBeVisible()
    expect(within(dialog).getByDisplayValue('Local draft')).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Save bookmarks' })).toBeDisabled()
    const reload = within(dialog).getByRole('button', { name: 'Reload saved bookmarks' })
    await user.click(reload)
    const confirmation = screen.getByRole('dialog', { name: 'Reload saved bookmarks?' })
    await user.click(within(confirmation).getByRole('button', { name: 'Keep this draft open' }))
    await waitFor(() => expect(reload).toHaveFocus())
    expect(within(dialog).getByDisplayValue('Local draft')).toBeVisible()

    await user.click(reload)
    await user.click(
      within(screen.getByRole('dialog', { name: 'Reload saved bookmarks?' })).getByRole('button', {
        name: 'Discard draft and reload',
      }),
    )
    expect(await within(dialog).findByDisplayValue('Remote')).toBeVisible()
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(onAnnounce).toHaveBeenCalledWith('Saved bookmarks changed elsewhere.')
  })

  it('reconciles an ambiguous transport failure only when the fresh document matches', async () => {
    api.put.mockRejectedValueOnce(
      new BookmarkTransportError('The bookmark request did not finish.'),
    )
    api.get.mockResolvedValueOnce(response()).mockResolvedValueOnce(
      response(
        [
          {
            name: 'Local draft',
            bookmarks: [
              { name: 'First', url: 'https://first.example/' },
              { name: 'Second', url: 'https://second.example/' },
            ],
          },
          { name: 'Projects', bookmarks: [{ name: 'Code', url: 'https://code.example/' }] },
        ],
        'b',
      ),
    )
    const onSaved = vi.fn(() => true)
    const onAnnounce = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSaved={onSaved} onAnnounce={onAnnounce} />)
    const dialog = await loadedSettings(user)
    const name = within(dialog).getAllByLabelText('Section name')[0]!
    fireEvent.change(name, { target: { value: 'Local draft' } })
    await user.click(within(dialog).getByRole('button', { name: 'Save bookmarks' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull())
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(onAnnounce).toHaveBeenLastCalledWith('Bookmarks saved.')
  })
})
