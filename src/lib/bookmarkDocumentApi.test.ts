import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BookmarkDocumentResponse, ReplaceBookmarkDocumentRequest } from '../shared/contracts'
import {
  BookmarkApiError,
  BookmarkTransportError,
  getBookmarkDocument,
  putBookmarkDocument,
} from './bookmarkDocumentApi'

const responseBody: BookmarkDocumentResponse = {
  schemaVersion: 1,
  revision: `sha256:${'a'.repeat(64)}`,
  document: {
    schemaVersion: 1,
    sections: [{ name: 'Daily', bookmarks: [{ name: 'Mail', url: 'https://example.com' }] }],
  },
  display: {
    schemaVersion: 1,
    data: {
      sections: ['Daily'],
      bookmarks: [
        {
          id: '0123456789abcdef',
          group: 'Daily',
          name: 'Mail',
          url: 'https://example.com',
          order: 0,
        },
      ],
      invalidEntryCount: 0,
    },
    meta: {
      generatedAt: '2026-09-09T12:00:00.000Z',
      sourceUpdatedAt: '2026-09-09T12:00:00.000Z',
      freshness: 'fresh',
      staleAfterMs: 60_000,
      issues: [],
    },
  },
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('bookmark document client transport', () => {
  it('performs a same-origin no-store GET and validates its complete response', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getBookmarkDocument()).resolves.toEqual(responseBody)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/bookmarks/document',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: { accept: 'application/json' },
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it('sends one strict whole-document PUT with the write marker', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const request: ReplaceBookmarkDocumentRequest = {
      schemaVersion: 1,
      baseRevision: responseBody.revision,
      document: responseBody.document,
    }

    await putBookmarkDocument(request)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/bookmarks/document',
      expect.objectContaining({
        method: 'PUT',
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-homedash-bookmark-write': '1',
        },
        body: JSON.stringify(request),
      }),
    )
  })

  it('preserves a validated server error and safely maps an unreadable error body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            code: 'bookmark-revision-conflict',
            message: 'Saved bookmarks changed elsewhere.',
            retryable: false,
          }),
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(new Response('<private>', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getBookmarkDocument()).rejects.toMatchObject({
      status: 409,
      body: { code: 'bookmark-revision-conflict', retryable: false },
    })
    await expect(getBookmarkDocument()).rejects.toEqual(
      expect.objectContaining<Partial<BookmarkApiError>>({
        status: 503,
        body: expect.objectContaining({
          code: 'bookmark-write-failed',
          message: 'The bookmark request could not be completed.',
          retryable: true,
        }),
      }),
    )
  })

  it('rejects a malformed success body instead of crossing the confirmed-save boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ...responseBody, revision: 'mtime:1' }))),
    )
    await expect(getBookmarkDocument()).rejects.toBeInstanceOf(BookmarkTransportError)
  })

  it('aborts an attempt after eight seconds and reports a transport failure', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted')))
          }),
      ),
    )

    const request = getBookmarkDocument()
    const failure = expect(request).rejects.toEqual(
      expect.objectContaining({ message: 'The bookmark request did not finish.' }),
    )
    await vi.advanceTimersByTimeAsync(8_000)
    await failure
  })
})
