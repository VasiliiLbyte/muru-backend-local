import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TtlCache } from './cache'

describe('TtlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns undefined for missing keys', () => {
    const cache = new TtlCache<string>(10, 60_000)
    expect(cache.get('missing')).toBeUndefined()
  })

  it('expires entries after ttl', () => {
    const cache = new TtlCache<string>(10, 1000)
    cache.set('a', 'value')
    expect(cache.get('a')).toBe('value')
    vi.advanceTimersByTime(1001)
    expect(cache.get('a')).toBeUndefined()
  })

  it('evicts oldest entry when maxSize exceeded', () => {
    const cache = new TtlCache<string>(2, 60_000)
    cache.set('first', '1')
    vi.advanceTimersByTime(10)
    cache.set('second', '2')
    vi.advanceTimersByTime(10)
    cache.set('third', '3')
    expect(cache.get('first')).toBeUndefined()
    expect(cache.get('second')).toBe('2')
    expect(cache.get('third')).toBe('3')
  })
})
