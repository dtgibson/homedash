import type { IssueCode } from './types.js'

export class SourceError extends Error {
  constructor(
    readonly code: IssueCode,
    message: string,
    readonly retryable = true,
    readonly statusCode = 502,
  ) {
    super(message)
  }
}

export function asSourceError(error: unknown, fallbackMessage: string): SourceError {
  if (error instanceof SourceError) return error
  if (error instanceof Error && error.name === 'AbortError') {
    return new SourceError('timeout', fallbackMessage, true, 504)
  }
  return new SourceError('upstream-unavailable', fallbackMessage, true, 502)
}

export function safeErrorBody(error: SourceError) {
  return {
    schemaVersion: 1 as const,
    code: error.code,
    message: error.message,
    retryable: error.retryable,
  }
}
