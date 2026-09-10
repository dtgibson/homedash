import { describe, expect, it } from 'vitest'
import { MemoryCache } from './cache'

describe('MemoryCache entry bounds', () => {
  it('evicts the oldest successful entry when the configured limit is reached', async () => {
    const cache = new MemoryCache<number>(2)

    await cache.load('first', 60_000, false, async () => 1)
    await cache.load('second', 60_000, false, async () => 2)
    await cache.load('third', 60_000, false, async () => 3)

    expect(cache.get('first')).toBeUndefined()
    expect(cache.get('second')?.value).toBe(2)
    expect(cache.get('third')?.value).toBe(3)
  })

  it('refreshes an existing entry without evicting another key', async () => {
    const cache = new MemoryCache<number>(2)

    await cache.load('first', 60_000, false, async () => 1)
    await cache.load('second', 60_000, false, async () => 2)
    await cache.load('first', 60_000, true, async () => 10)

    expect(cache.get('first')?.value).toBe(10)
    expect(cache.get('second')?.value).toBe(2)
  })
})
