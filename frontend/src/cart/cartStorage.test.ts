import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cartStorageKey,
  clearCartSnapshot,
  readCartSnapshot,
  writeCartSnapshot,
} from './cartStorage'
import type { CheckoutForm } from '../types/cart'

const checkout: CheckoutForm = {
  deliveryMode: 'delivery',
  deliveryOption: 'DOOR',
  deliveryPrice: 0,
  deliveryEta: '',
  address: '',
  comment: '',
  birthDate: '',
}

const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
    clear: () => storage.clear(),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cartStorage', () => {
  it('returns null for invalid user id', () => {
    expect(readCartSnapshot(undefined)).toBeNull()
    expect(readCartSnapshot(1.5)).toBeNull()
  })

  it('roundtrips items and checkout', () => {
    writeCartSnapshot(42, {
      items: [{ sku: 'MU0001', name: 'Test', price: 100, quantity: 2 }],
      checkout,
    })
    const snapshot = readCartSnapshot(42)
    expect(snapshot?.items).toHaveLength(1)
    expect(snapshot?.items[0]?.sku).toBe('MU0001')
    expect(snapshot?.checkout.deliveryMode).toBe('delivery')
    expect(snapshot?.savedAt).toBeTypeOf('number')
  })

  it('returns null for corrupted json', () => {
    localStorage.setItem(cartStorageKey(7), '{not-json')
    expect(readCartSnapshot(7)).toBeNull()
  })

  it('filters invalid cart lines', () => {
    localStorage.setItem(
      cartStorageKey(8),
      JSON.stringify({
        items: [{ sku: 'ok', name: 'Ok', price: 10, quantity: 1 }, { sku: '', name: 'Bad', price: 1, quantity: 1 }],
        checkout,
        savedAt: Date.now(),
      }),
    )
    expect(readCartSnapshot(8)?.items).toHaveLength(1)
  })

  it('clears snapshot', () => {
    writeCartSnapshot(9, { items: [], checkout })
    clearCartSnapshot(9)
    expect(readCartSnapshot(9)).toBeNull()
  })
})
