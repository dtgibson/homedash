import {
  bookmarkDocumentErrorResponseSchema,
  bookmarkDocumentResponseSchema,
  type BookmarkDocumentErrorResponse,
  type BookmarkDocumentResponse,
  type ReplaceBookmarkDocumentRequest,
} from '../shared/contracts'

const ATTEMPT_TIMEOUT_MS = 8_000

export class BookmarkApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: BookmarkDocumentErrorResponse,
  ) {
    super(body.message)
  }
}

export class BookmarkTransportError extends Error {
  constructor(message: string) {
    super(message)
  }
}

function fallbackError(status: number): BookmarkDocumentErrorResponse {
  return {
    schemaVersion: 1,
    code:
      status === 409
        ? 'bookmark-revision-conflict'
        : status === 413
          ? 'bookmark-request-too-large'
          : status === 415
            ? 'bookmark-media-type-unsupported'
            : status === 403
              ? 'bookmark-request-forbidden'
              : 'bookmark-write-failed',
    message:
      status === 409
        ? 'Saved bookmarks changed elsewhere. Reload them before saving this draft.'
        : 'The bookmark request could not be completed.',
    retryable: status >= 500,
  }
}

async function request(
  init: RequestInit,
  outerSignal?: AbortSignal,
): Promise<BookmarkDocumentResponse> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  outerSignal?.addEventListener('abort', abort, { once: true })
  const timeout = window.setTimeout(abort, ATTEMPT_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch('/api/bookmarks/document', { ...init, signal: controller.signal })
  } catch {
    throw new BookmarkTransportError('The bookmark request did not finish.')
  } finally {
    window.clearTimeout(timeout)
    outerSignal?.removeEventListener('abort', abort)
  }

  let value: unknown
  try {
    value = await response.json()
  } catch {
    if (!response.ok) throw new BookmarkApiError(response.status, fallbackError(response.status))
    throw new BookmarkTransportError('The bookmark response could not be read.')
  }
  if (!response.ok) {
    const parsedError = bookmarkDocumentErrorResponseSchema.safeParse(value)
    throw new BookmarkApiError(
      response.status,
      parsedError.success ? parsedError.data : fallbackError(response.status),
    )
  }
  const parsed = bookmarkDocumentResponseSchema.safeParse(value)
  if (!parsed.success) throw new BookmarkTransportError('The bookmark response could not be read.')
  return parsed.data
}

export function getBookmarkDocument(signal?: AbortSignal) {
  return request(
    {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    },
    signal,
  )
}

export function putBookmarkDocument(value: ReplaceBookmarkDocumentRequest, signal?: AbortSignal) {
  return request(
    {
      method: 'PUT',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-homedash-bookmark-write': '1',
      },
      body: JSON.stringify(value),
      cache: 'no-store',
    },
    signal,
  )
}
