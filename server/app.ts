import { existsSync } from 'node:fs'
import path from 'node:path'
import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'
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
    "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
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

export async function buildApp(options: BuildAppOptions) {
  const app = Fastify({ logger: false, bodyLimit: 32 * 1024 })
  const weather = new WeatherService(options.config, options.fetchImpl)
  const bookmarks = new BookmarkService(options.config)
  const ebird = new EbirdService(options.config, options.fetchImpl)
  const llmdash = new LlmdashService(options.config, options.fetchImpl)

  app.addHook('onSend', async (_request, reply) => {
    for (const [name, value] of Object.entries(securityHeaders)) reply.header(name, value)
  })

  app.get('/healthz', async () => ({ ok: true, service: 'homedash' }))

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
  if (options.serveClient !== false && existsSync(distRoot)) {
    await app.register(fastifyStatic, { root: distRoot, wildcard: false })
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api/')) {
        return reply.sendFile('index.html', { maxAge: 0, immutable: false })
      }
      return reply.status(404).send({ schemaVersion: 1, code: 'not-found', message: 'Not found.' })
    })
  }

  return app
}
