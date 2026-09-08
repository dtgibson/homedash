export interface CacheRecord<T> {
  value: T
  fetchedAt: number
  expiresAt: number
}

export class MemoryCache<T> {
  private readonly records = new Map<string, CacheRecord<T>>()
  private readonly inflight = new Map<string, Promise<T>>()

  get(key: string) {
    return this.records.get(key)
  }

  async load(key: string, ttlMs: number, force: boolean, loader: () => Promise<T>): Promise<T> {
    const now = Date.now()
    const hit = this.records.get(key)
    if (!force && hit && hit.expiresAt > now) return hit.value

    const running = this.inflight.get(key)
    if (running) return running

    const pending = loader()
      .then((value) => {
        this.records.set(key, { value, fetchedAt: Date.now(), expiresAt: Date.now() + ttlMs })
        return value
      })
      .finally(() => this.inflight.delete(key))
    this.inflight.set(key, pending)
    return pending
  }
}
