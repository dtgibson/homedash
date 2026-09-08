import { z } from 'zod'
import type { ApiIssue, LlmdashEnvelope, LlmdashSummary } from '../src/shared/contracts.js'
import type { AppConfig } from './config.js'
import { MemoryCache } from './cache.js'
import { asSourceError, SourceError } from './errors.js'
import { fetchWithTimeout } from './fetch.js'
import type { FetchLike } from './types.js'

const rawWindowSchema = z.object({
  remainingPct: z.number().min(0).max(100),
  resetsAt: z.iso.datetime().nullable(),
  capturedAt: z.iso.datetime(),
})

const rawToolSchema = z.object({
  source: z.string(),
  label: z.string().min(1),
  limits: z.object({
    five_hour: rawWindowSchema.nullable().optional(),
    seven_day: rawWindowSchema.nullable().optional(),
  }),
  freshness: z
    .object({ capturedAt: z.iso.datetime().nullable(), staleAfterMs: z.number().positive() })
    .nullable()
    .optional(),
  limitsDiagnostic: z
    .object({ reason: z.string().min(1).max(80) })
    .passthrough()
    .nullable()
    .optional(),
})

const rawStateSchema = z.object({
  generatedAt: z.iso.datetime(),
  tools: z.array(rawToolSchema),
})

const LLMDASH_STALE_MS = 15 * 60_000

export class LlmdashService {
  private readonly cache = new MemoryCache<LlmdashEnvelope>()

  constructor(
    private readonly config: AppConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async load(force = false): Promise<LlmdashEnvelope> {
    const previous = this.cache.get('state')
    try {
      return await this.cache.load('state', 5_000, force, async () => {
        const response = await fetchWithTimeout(
          this.fetchImpl,
          `${this.config.llmdashUrl}/api/state`,
          { headers: { accept: 'application/json' } },
          this.config.upstreamTimeoutMs,
          'llmdash',
        )
        const raw = rawStateSchema.safeParse(await response.json())
        if (!raw.success) {
          throw new SourceError(
            'invalid-upstream-payload',
            'llmdash returned an unreadable response.',
            true,
          )
        }

        const issues: ApiIssue[] = []
        const providers: LlmdashSummary['providers'] = [
          this.normalizeProvider(raw.data.tools, 'claude-code', 'claude', 'Claude Code', issues),
          this.normalizeProvider(raw.data.tools, 'codex', 'codex', 'Codex', issues),
        ]
        const sourceTimes = providers.flatMap((provider) =>
          [provider.fiveHour?.capturedAt, provider.weekly?.capturedAt].filter(
            (value): value is string => Boolean(value),
          ),
        )
        const sourceUpdatedAt = sourceTimes.sort().at(-1) ?? raw.data.generatedAt
        const stale = Date.now() - Date.parse(sourceUpdatedAt) > LLMDASH_STALE_MS

        return {
          schemaVersion: 1,
          data: { providers, generatedAt: raw.data.generatedAt },
          meta: {
            generatedAt: new Date().toISOString(),
            sourceUpdatedAt,
            freshness: stale ? 'stale' : 'fresh',
            staleAfterMs: LLMDASH_STALE_MS,
            issues,
          },
        }
      })
    } catch (error) {
      if (previous) {
        const sourceError = asSourceError(error, 'llmdash could not be refreshed.')
        return {
          ...previous.value,
          meta: {
            ...previous.value.meta,
            freshness: 'stale',
            issues: [
              {
                code: sourceError.code,
                message: 'Showing the last llmdash reading because refresh failed.',
                retryable: sourceError.retryable,
              },
            ],
          },
        }
      }
      throw asSourceError(error, 'llmdash could not be reached.')
    }
  }

  private normalizeProvider(
    tools: z.infer<typeof rawToolSchema>[],
    source: string,
    id: 'claude' | 'codex',
    fallbackLabel: string,
    issues: ApiIssue[],
  ) {
    const tool = tools.find((candidate) => candidate.source === source)
    if (!tool) {
      issues.push({
        code: 'partial-data',
        message: `${fallbackLabel} is not present in the llmdash response.`,
        retryable: true,
      })
      return { id, label: fallbackLabel, fiveHour: null, weekly: null, diagnostic: 'no-reading' }
    }
    if (!tool.limits.five_hour || !tool.limits.seven_day || tool.limitsDiagnostic) {
      issues.push({
        code: 'partial-data',
        message: `${tool.label} has incomplete or aging limit data.`,
        retryable: true,
      })
    }
    return {
      id,
      label: tool.label,
      fiveHour: tool.limits.five_hour ?? null,
      weekly: tool.limits.seven_day ?? null,
      diagnostic: tool.limitsDiagnostic?.reason ?? null,
    }
  }
}
