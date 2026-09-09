import { existsSync } from 'node:fs'
import path from 'node:path'
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyReply } from 'fastify'
import { z } from 'zod'
import { locationSelectorSchema } from '../src/shared/contracts.js'
import { BookmarkService } from './bookmarks.js'
import type { AppConfig } from './config.js'
import { EbirdService } from './ebird.js'
import { safeErrorBody, SourceError } from './errors.js'
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

export async function buildApp(options: BuildAppOptions) {
  const app = Fastify({
    logger: false,
    bodyLimit: 32 * 1024,
    frameworkErrors: (error, request, reply) => {
      const frameworkReply = reply as FastifyReply
      applySecurityHeaders(frameworkReply)
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
  const weather = new WeatherService(options.config, options.fetchImpl)
  const bookmarks = new BookmarkService(options.config)
  const ebird = new EbirdService(options.config, options.fetchImpl)
  const llmdash = new LlmdashService(options.config, options.fetchImpl)

  app.addHook('onSend', async (_request, reply) => {
    applySecurityHeaders(reply)
  })

  app.addHook('onRequest', async (request, reply) => {
    const rawPath = (request.raw.url ?? '').split('?', 1)[0].toLowerCase()
    if (
      rawPath.startsWith('/launch/ebird/map/') &&
      (rawPath.includes('/../') ||
        rawPath.includes('%2e') ||
        rawPath.includes('%2f') ||
        rawPath.includes('%5c') ||
        rawPath.includes('\\'))
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
