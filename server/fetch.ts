import { SourceError } from './errors.js'
import type { FetchLike } from './types.js'

export async function fetchWithTimeout(
  fetchImpl: FetchLike,
  input: string | URL,
  init: RequestInit,
  timeoutMs: number,
  sourceName: string,
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(input, {
      ...init,
      signal: controller.signal,
      redirect: 'error',
    })
    if (!response.ok) {
      const code =
        response.status === 401 || response.status === 403
          ? 'missing-configuration'
          : response.status === 429
            ? 'rate-limited'
            : 'upstream-unavailable'
      throw new SourceError(
        code,
        `${sourceName} could not provide a current reading.`,
        response.status !== 401 && response.status !== 403,
        response.status === 429 ? 503 : 502,
      )
    }
    return response
  } catch (error) {
    if (error instanceof SourceError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new SourceError('timeout', `${sourceName} took too long to respond.`, true, 504)
    }
    throw new SourceError('upstream-unavailable', `${sourceName} could not be reached.`, true, 502)
  } finally {
    clearTimeout(timeout)
  }
}
