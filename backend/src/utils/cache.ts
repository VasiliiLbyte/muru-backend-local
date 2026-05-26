type CacheEntry<T> = {
  value: T
  expiresAt: number
  createdAt: number
}

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>()

  constructor(
    private maxSize: number,
    private ttlMs: number,
  ) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      let oldestKey: string | null = null
      let oldestAt = Infinity
      for (const [k, entry] of this.store) {
        if (entry.createdAt < oldestAt) {
          oldestAt = entry.createdAt
          oldestKey = k
        }
      }
      if (oldestKey) this.store.delete(oldestKey)
    }
    const now = Date.now()
    this.store.set(key, {
      value,
      expiresAt: now + this.ttlMs,
      createdAt: now,
    })
  }

  clear(): void {
    this.store.clear()
  }
}
