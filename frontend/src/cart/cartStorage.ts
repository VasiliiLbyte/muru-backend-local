import type { CartItem, CheckoutForm } from '../types/cart'

export type CartSnapshot = {
  items: CartItem[]
  checkout: CheckoutForm
  savedAt: number
}

const STORAGE_PREFIX = 'muru-cart:v1:'

export const cartStorageKey = (telegramUserId: number): string => `${STORAGE_PREFIX}${telegramUserId}`

const isCartItem = (value: unknown): value is CartItem => {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    typeof row.sku === 'string' &&
    row.sku.length > 0 &&
    typeof row.name === 'string' &&
    typeof row.price === 'number' &&
    Number.isFinite(row.price) &&
    typeof row.quantity === 'number' &&
    Number.isInteger(row.quantity) &&
    row.quantity > 0
  )
}

const isCheckoutForm = (value: unknown): value is CheckoutForm => {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    (row.deliveryMode === 'delivery' || row.deliveryMode === 'pickup') &&
    typeof row.deliveryOption === 'string' &&
    typeof row.deliveryPrice === 'number' &&
    Number.isFinite(row.deliveryPrice) &&
    typeof row.deliveryEta === 'string' &&
    typeof row.address === 'string' &&
    typeof row.comment === 'string' &&
    typeof row.birthDate === 'string'
  )
}

const parseSnapshot = (raw: string): CartSnapshot | null => {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const row = parsed as Record<string, unknown>
    if (!Array.isArray(row.items) || !isCheckoutForm(row.checkout)) return null
    const items = row.items.filter(isCartItem)
    if (typeof row.savedAt !== 'number' || !Number.isFinite(row.savedAt)) return null
    return { items, checkout: row.checkout, savedAt: row.savedAt }
  } catch {
    return null
  }
}

export const readCartSnapshot = (telegramUserId?: number): CartSnapshot | null => {
  if (!telegramUserId || !Number.isInteger(telegramUserId)) return null
  try {
    const raw = localStorage.getItem(cartStorageKey(telegramUserId))
    if (!raw) return null
    return parseSnapshot(raw)
  } catch (err) {
    console.warn('[cart-storage] read failed', err)
    return null
  }
}

export const writeCartSnapshot = (
  telegramUserId: number,
  snapshot: Omit<CartSnapshot, 'savedAt'> & { savedAt?: number },
): void => {
  if (!Number.isInteger(telegramUserId)) return
  const payload: CartSnapshot = {
    items: snapshot.items,
    checkout: snapshot.checkout,
    savedAt: snapshot.savedAt ?? Date.now(),
  }
  try {
    localStorage.setItem(cartStorageKey(telegramUserId), JSON.stringify(payload))
  } catch (err) {
    console.warn('[cart-storage] write failed', err)
  }
}

export const clearCartSnapshot = (telegramUserId?: number): void => {
  if (!telegramUserId || !Number.isInteger(telegramUserId)) return
  try {
    localStorage.removeItem(cartStorageKey(telegramUserId))
  } catch (err) {
    console.warn('[cart-storage] clear failed', err)
  }
}
