import { existsSync } from 'node:fs'
import path from 'node:path'
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  BOOKMARK_DOCUMENT_FIELD_ERROR_LIMIT,
  BOOKMARK_DOCUMENT_FIELD_PATH_LIMIT,
  type BookmarkDocumentFieldError,
} from '../src/shared/bookmarkDocument.js'
import {
  locationSelectorSchema,
  replaceBookmarkDocumentRequestSchema,
  type BookmarkDocumentErrorResponse,
} from '../src/shared/contracts.js'
import { BookmarkDocumentServiceError, BookmarkService } from './bookmarks.js'
import type { AppConfig } from './config.js'
import { EbirdService } from './ebird.js'
import { safeErrorBody, SourceError } from './errors.js'
import { FAVICON_DEADLINE_MS, FaviconResolver } from './favicon.js'
import { LlmdashService } from './llmdash.js'
import { resolveLocation } from './location.js'
import type { FetchLike } from './types.js'
import { WeatherService } from './weather.js'

const ebirdRequestSchema = z.object({
  location: locationSelectorSchema,
  timeZone: z.string().min(1).max(80),
})

const securityHeaders = {
  'content-security-policy':
    "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action https://kagi.com/search",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'permissions-policy': 'geolocation=(self), camera=(), microphone=()',
  'cross-origin-resource-policy': 'same-origin',
}

export interface BuildAppOptions {
  config: AppConfig
  fetchImpl?: FetchLike
  serveClient?: boolean
}

function forceRefresh(headers: Record<string, unknown>) {
  return headers['x-homedash-refresh'] === '1'
}

function hasQuery(query: unknown) {
  return Boolean(query && typeof query === 'object' && Object.keys(query).length)
}

function isLaunchNamespace(url: string | undefined) {
  const pathOnly = (url ?? '').split('?', 1)[0]
  return pathOnly === '/launch' || pathOnly.startsWith('/launch/')
}

function isFaviconNamespace(url: string | undefined) {
  const pathOnly = (url ?? '').split('?', 1)[0].toLowerCase()
  return pathOnly.startsWith('/api/bookmarks/')
}

function isBookmarkDocumentNamespace(url: string | undefined) {
  const pathOnly = (url ?? '').split('?', 1)[0].toLowerCase()
  return pathOnly.startsWith('/api/bookmarks/document')
}

function bookmarkDocumentError(
  code: BookmarkDocumentErrorResponse['code'],
  message: string,
  retryable: boolean,
  fieldErrors?: BookmarkDocumentErrorResponse['fieldErrors'],
): BookmarkDocumentErrorResponse {
  const publicFieldErrors = fieldErrors
    ?.slice(0, BOOKMARK_DOCUMENT_FIELD_ERROR_LIMIT)
    .map((fieldError) => ({
      ...fieldError,
      path: publicBookmarkFieldPath(fieldError.path),
    }))
  return {
    schemaVersion: 1,
    code,
    message,
    retryable,
    ...(publicFieldErrors?.length ? { fieldErrors: publicFieldErrors } : {}),
  }
}

const PUBLIC_BOOKMARK_FIELD_PATH =
  /^\/document(?:\/schemaVersion|\/sections(?:\/\d+(?:\/name|\/bookmarks(?:\/\d+(?:\/name|\/url)?)?)?)?)?$/

function publicBookmarkFieldPath(path: BookmarkDocumentFieldError['path']) {
  return path.length <= BOOKMARK_DOCUMENT_FIELD_PATH_LIMIT && PUBLIC_BOOKMARK_FIELD_PATH.test(path)
    ? path
    : '/document'
}

function sendBookmarkDocumentError(
  reply: FastifyReply,
  statusCode: number,
  body: BookmarkDocumentErrorResponse,
) {
  return reply.status(statusCode).header('cache-control', 'no-store').send(body)
}

function requestHost(request: FastifyRequest) {
  const supplied = request.headers.host
  if (!supplied || supplied.includes(',') || supplied !== supplied.trim()) return null
  try {
    const parsed = new URL(`http://${supplied}`)
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      return null
    }
    return parsed.host
  } catch {
    return null
  }
}

function authorizedDocumentHost(request: FastifyRequest, allowedOrigins: readonly string[]) {
  const host = requestHost(request)
  return Boolean(host && allowedOrigins.some((origin) => new URL(origin).host === host))
}

function validDocumentOrigin(request: FastifyRequest, allowedOrigins: readonly string[]) {
  const supplied = request.headers.origin
  if (!supplied) return true
  try {
    const parsed = new URL(supplied)
    return (
      parsed.origin === supplied &&
      allowedOrigins.includes(parsed.origin) &&
      parsed.host === requestHost(request)
    )
  } catch {
    return false
  }
}

function isJsonMediaType(value: string | undefined) {
  return Boolean(
    value && /^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(value),
  )
}

function invalidLaunchRequest() {
  return safeErrorBody(
    new SourceError('invalid-configuration', 'The launch request is invalid.', false, 400),
  )
}

function invalidRequestUrl(statusCode: number) {
  return safeErrorBody(
    new SourceError('invalid-configuration', 'The request URL is invalid.', false, statusCode),
  )
}

function applySecurityHeaders(reply: FastifyReply) {
  for (const [name, value] of Object.entries(securityHeaders)) reply.header(name, value)
}

function sendEmptyFavicon(reply: FastifyReply, cacheControl: string) {
  return reply.status(404).header('cache-control', cacheControl).send()
}

export async function buildApp(options: BuildAppOptions) {
  const app = Fastify({
    logger: false,
    bodyLimit: 32 * 1024,
    frameworkErrors: (error, request, reply) => {
      const frameworkReply = reply as FastifyReply
      applySecurityHeaders(frameworkReply)
      if (isBookmarkDocumentNamespace(request.raw.url)) {
        const tooLarge = error.code === 'FST_ERR_CTP_BODY_TOO_LARGE'
        const unsupported = error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE'
        sendBookmarkDocumentError(
          frameworkReply,
          tooLarge ? 413 : unsupported ? 415 : 400,
          bookmarkDocumentError(
            tooLarge
              ? 'bookmark-request-too-large'
              : unsupported
                ? 'bookmark-media-type-unsupported'
                : 'bookmark-request-invalid',
            tooLarge
              ? 'The bookmark request is too large.'
              : unsupported
                ? 'Bookmark changes must use JSON.'
                : 'The bookmark request is invalid.',
            false,
          ),
        )
        return
      }
      if (isFaviconNamespace(request.raw.url)) {
        sendEmptyFavicon(frameworkReply, 'no-store')
        return
      }
      if (isLaunchNamespace(request.raw.url)) {
        frameworkReply.status(400).send(invalidLaunchRequest())
        return
      }
      if (error.code === 'FST_ERR_BAD_URL' || error.code === 'FST_ERR_MAX_PARAM_LENGTH') {
        frameworkReply
          .status(error.statusCode ?? 400)
          .send(invalidRequestUrl(error.statusCode ?? 400))
        return
      }
      frameworkReply.send(error)
    },
  })
  const favicons = new FaviconResolver(options.fetchImpl)
  const weather = new WeatherService(options.config, options.fetchImpl)
  const bookmarks = new BookmarkService(options.config, {
    invalidateBookmarkId: (bookmarkId) => favicons.invalidateBookmarkId(bookmarkId),
  })
  const ebird = new EbirdService(options.config, options.fetchImpl)
  const llmdash = new LlmdashService(options.config, options.fetchImpl)

  app.setErrorHandler((error, request, reply) => {
    if (isBookmarkDocumentNamespace(request.raw.url)) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
      const tooLarge = code === 'FST_ERR_CTP_BODY_TOO_LARGE'
      const unsupported = code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE'
      return sendBookmarkDocumentError(
        reply,
        tooLarge ? 413 : unsupported ? 415 : 400,
        bookmarkDocumentError(
          tooLarge
            ? 'bookmark-request-too-large'
            : unsupported
              ? 'bookmark-media-type-unsupported'
              : 'bookmark-request-invalid',
          tooLarge
            ? 'The bookmark request is too large.'
            : unsupported
              ? 'Bookmark changes must use JSON.'
              : 'The bookmark request is invalid.',
          false,
        ),
      )
    }
    return reply.send(error)
  })

  app.addHook('onSend', async (_request, reply) => {
    applySecurityHeaders(reply)
  })

  app.addHook('onRequest', async (request, reply) => {
    const rawUrl = request.raw.url ?? ''
    const rawPath = rawUrl.split('?', 1)[0]
    if (isBookmarkDocumentNamespace(rawUrl)) {
      if (rawPath !== '/api/bookmarks/document' || rawUrl.includes('?')) {
        return sendBookmarkDocumentError(
          reply,
          404,
          bookmarkDocumentError(
            'bookmark-request-invalid',
            'The bookmark document request is invalid.',
            false,
          ),
        )
      }
      if (request.method !== 'GET' && request.method !== 'PUT') {
        reply.header('allow', 'GET, PUT')
        return sendBookmarkDocumentError(
          reply,
          405,
          bookmarkDocumentError(
            'bookmark-request-invalid',
            'This bookmark document method is not supported.',
            false,
          ),
        )
      }
      if (
        !authorizedDocumentHost(request, options.config.bookmarkDocumentOrigins) ||
        !validDocumentOrigin(request, options.config.bookmarkDocumentOrigins) ||
        (request.headers['sec-fetch-site'] != null &&
          request.headers['sec-fetch-site'] !== 'same-origin')
      ) {
        return sendBookmarkDocumentError(
          reply,
          403,
          bookmarkDocumentError(
            'bookmark-request-forbidden',
            'This bookmark document request is not allowed.',
            false,
          ),
        )
      }
      if (request.method === 'PUT') {
        const encoding = request.headers['content-encoding']?.trim().toLowerCase()
        const forbidden = request.headers['x-homedash-bookmark-write'] !== '1'
        if (forbidden) {
          return sendBookmarkDocumentError(
            reply,
            403,
            bookmarkDocumentError(
              'bookmark-request-forbidden',
              'This bookmark change is not allowed.',
              false,
            ),
          )
        }
        if (encoding && encoding !== 'identity') {
          return sendBookmarkDocumentError(
            reply,
            415,
            bookmarkDocumentError(
              'bookmark-media-type-unsupported',
              'Compressed bookmark changes are not supported.',
              false,
            ),
          )
        }
        if (!isJsonMediaType(request.headers['content-type'])) {
          return sendBookmarkDocumentError(
            reply,
            415,
            bookmarkDocumentError(
              'bookmark-media-type-unsupported',
              'Bookmark changes must use JSON.',
              false,
            ),
          )
        }
      }
    }
    if (
      !isBookmarkDocumentNamespace(rawUrl) &&
      isFaviconNamespace(rawUrl) &&
      (request.method !== 'GET' ||
        rawUrl.includes('?') ||
        !/^\/api\/bookmarks\/[a-f0-9]{16}\/favicon$/.test(rawPath))
    ) {
      return sendEmptyFavicon(reply, 'no-store')
    }
    const normalizedRawPath = rawPath.toLowerCase()
    if (
      normalizedRawPath.startsWith('/launch/ebird/map/') &&
      (normalizedRawPath.includes('/../') ||
        normalizedRawPath.includes('%2e') ||
        normalizedRawPath.includes('%2f') ||
        normalizedRawPath.includes('%5c') ||
        normalizedRawPath.includes('\\'))
    ) {
      return reply.status(400).send(invalidLaunchRequest())
    }
  })

  app.get('/healthz', async () => ({ ok: true, service: 'homedash' }))

  app.get('/launch/ebird/my-ebird', { exposeHeadRoute: false }, async (request, reply) => {
    if (hasQuery(request.query)) return reply.status(400).send(invalidLaunchRequest())
    return reply
      .status(302)
      .header('cache-control', 'no-store')
      .header('location', 'https://ebird.org/myebird')
      .send()
  })

  app.get<{ Params: { speciesCode: string } }>(
    '/launch/ebird/map/:speciesCode',
    { exposeHeadRoute: false },
    async (request, reply) => {
      if (hasQuery(request.query) || !/^[a-z0-9]{3,24}$/.test(request.params.speciesCode)) {
        return reply.status(400).send(invalidLaunchRequest())
      }
      const destination = new URL(
        encodeURIComponent(request.params.speciesCode),
        'https://ebird.org/map/',
      )
      return reply
        .status(302)
        .header('cache-control', 'no-store')
        .header('location', destination.toString())
        .send()
    },
  )

  app.get('/launch/llmdash', { exposeHeadRoute: false }, async (request, reply) => {
    if (hasQuery(request.query)) return reply.status(400).send(invalidLaunchRequest())
    const destination = options.config.llmdashLaunch
    if (destination.status === 'unavailable') {
      const missing = destination.reason === 'missing'
      return reply
        .status(503)
        .send(
          safeErrorBody(
            new SourceError(
              missing ? 'missing-configuration' : 'invalid-configuration',
              missing
                ? 'The llmdash launch destination is not configured.'
                : 'The llmdash launch destination is invalid.',
              false,
              503,
            ),
          ),
        )
    }
    return reply
      .status(302)
      .header('cache-control', 'no-store')
      .header('location', destination.url.toString())
      .send()
  })

  app.post('/api/weather', async (request, reply) => {
    const parsed = locationSelectorSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(
          safeErrorBody(
            new SourceError(
              'invalid-configuration',
              'The location request is invalid.',
              false,
              400,
            ),
          ),
        )
    }
    try {
      return await weather.load(
        resolveLocation(parsed.data, options.config),
        forceRefresh(request.headers),
      )
    } catch (error) {
      const safe =
        error instanceof SourceError
          ? error
          : new SourceError('upstream-unavailable', 'Weather could not be reached.')
      return reply.status(safe.statusCode).send(safeErrorBody(safe))
    }
  })

  app.get('/api/bookmarks', async (_request, reply) => {
    try {
      return await bookmarks.load()
    } catch (error) {
      const safe =
        error instanceof SourceError
          ? error
          : new SourceError('invalid-configuration', 'Bookmarks could not be read.', false, 503)
      return reply.status(safe.statusCode).send(safeErrorBody(safe))
    }
  })

  app.get('/api/bookmarks/document', { exposeHeadRoute: false }, async (_request, reply) => {
    try {
      const response = await bookmarks.getDocument()
      return reply.header('cache-control', 'no-store').send(response)
    } catch (error) {
      const safe =
        error instanceof BookmarkDocumentServiceError
          ? error
          : new BookmarkDocumentServiceError(
              'bookmark-source-unavailable',
              'The bookmark file could not be read. Check the host configuration and try again.',
              true,
              503,
            )
      return sendBookmarkDocumentError(
        reply,
        safe.statusCode,
        bookmarkDocumentError(safe.code, safe.message, safe.retryable, safe.fieldErrors),
      )
    }
  })

  app.put('/api/bookmarks/document', { bodyLimit: 65_536 }, async (request, reply) => {
    const parsed = replaceBookmarkDocumentRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBookmarkDocumentError(
        reply,
        400,
        bookmarkDocumentError(
          'bookmark-request-invalid',
          'The bookmark request is invalid.',
          false,
        ),
      )
    }
    try {
      const response = await bookmarks.saveDocument(parsed.data.baseRevision, parsed.data.document)
      return reply.header('cache-control', 'no-store').send(response)
    } catch (error) {
      const safe =
        error instanceof BookmarkDocumentServiceError
          ? error
          : new BookmarkDocumentServiceError(
              'bookmark-write-failed',
              'Bookmarks could not be saved. Check the host storage and try again.',
              true,
              503,
            )
      return sendBookmarkDocumentError(
        reply,
        safe.statusCode,
        bookmarkDocumentError(safe.code, safe.message, safe.retryable, safe.fieldErrors),
      )
    }
  })

  app.get<{ Params: { bookmarkId: string } }>(
    '/api/bookmarks/:bookmarkId/favicon',
    { exposeHeadRoute: false },
    async (request, reply) => {
      const deadlineAtMs = Date.now() + FAVICON_DEADLINE_MS
      let bookmark
      let timeout: ReturnType<typeof setTimeout> | undefined
      try {
        bookmark = await Promise.race([
          bookmarks.findCurrentById(request.params.bookmarkId).catch(() => null),
          new Promise<null>((resolve) => {
            timeout = setTimeout(() => resolve(null), Math.max(0, deadlineAtMs - Date.now()))
          }),
        ])
      } catch {
        bookmark = null
      } finally {
        if (timeout) clearTimeout(timeout)
      }
      if (!bookmark) {
        favicons.invalidateBookmarkId(request.params.bookmarkId)
        return sendEmptyFavicon(reply, 'no-store')
      }

      const outcome = await favicons.resolve(bookmark, deadlineAtMs)
      if (outcome.kind === 'unavailable') {
        return sendEmptyFavicon(reply, 'private, max-age=900')
      }
      return reply
        .status(200)
        .header('content-type', outcome.image.mimeType)
        .header('content-length', String(outcome.image.bytes.byteLength))
        .header('cache-control', 'private, max-age=86400')
        .send(Buffer.from(outcome.image.bytes))
    },
  )

  app.post('/api/ebird/summary', async (request, reply) => {
    const parsed = ebirdRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(
          safeErrorBody(
            new SourceError('invalid-configuration', 'The eBird request is invalid.', false, 400),
          ),
        )
    }
    try {
      return await ebird.load(
        resolveLocation(parsed.data.location, options.config),
        parsed.data.timeZone,
        forceRefresh(request.headers),
      )
    } catch (error) {
      const safe =
        error instanceof SourceError
          ? error
          : new SourceError('upstream-unavailable', 'SnowRaven could not provide eBird data.')
      return reply.status(safe.statusCode).send(safeErrorBody(safe))
    }
  })

  app.get('/api/llmdash/summary', async (request, reply) => {
    try {
      return await llmdash.load(forceRefresh(request.headers))
    } catch (error) {
      const safe =
        error instanceof SourceError
          ? error
          : new SourceError('upstream-unavailable', 'llmdash could not be reached.')
      return reply.status(safe.statusCode).send(safeErrorBody(safe))
    }
  })

  const distRoot = path.resolve('dist')
  const servesClient = options.serveClient !== false && existsSync(distRoot)
  if (servesClient) {
    await app.register(fastifyStatic, { root: distRoot, wildcard: false })
  }
  app.setNotFoundHandler((request, reply) => {
    if (isBookmarkDocumentNamespace(request.raw.url)) {
      return sendBookmarkDocumentError(
        reply,
        404,
        bookmarkDocumentError(
          'bookmark-request-invalid',
          'The bookmark document request is invalid.',
          false,
        ),
      )
    }
    if (isFaviconNamespace(request.raw.url)) return sendEmptyFavicon(reply, 'no-store')
    if (
      servesClient &&
      request.method === 'GET' &&
      !request.url.startsWith('/api/') &&
      !isLaunchNamespace(request.url)
    ) {
      return reply.sendFile('index.html', { maxAge: 0, immutable: false })
    }
    return reply.status(404).send({ schemaVersion: 1, code: 'not-found', message: 'Not found.' })
  })

  return app
}
