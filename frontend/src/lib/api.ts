import type { CatalogNode, CatalogProduct } from '../types/catalog'

export type SyncApiResult = {
  totalRows: number
  syncedProducts: number
  skippedProducts: number
  errors: Array<{ sku: string; reason: string }>
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

export const triggerCatalogSync = async (telegramUserId: number): Promise<SyncApiResult> => {
  const response = await fetch(`${API_BASE_URL}/api/admin/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-user-id': String(telegramUserId),
    },
    body: JSON.stringify({ telegramUserId }),
  })

  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Sync request failed')
  }

  return payload.data as SyncApiResult
}

export const fetchCatalogTree = async (): Promise<CatalogNode[]> => {
  const response = await fetch(`${API_BASE_URL}/api/catalog/tree`)
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to load catalog tree')
  }
  return payload.data as CatalogNode[]
}

export const fetchCatalogProducts = async (params: {
  category?: string
  subcategory?: string
  q?: string
  color?: string
  size?: string
  priceMax?: number
}): Promise<CatalogProduct[]> => {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') searchParams.set(key, String(value))
  })
  const query = searchParams.toString()
  const response = await fetch(`${API_BASE_URL}/api/catalog/products${query ? `?${query}` : ''}`)
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to load catalog products')
  }
  return payload.data as CatalogProduct[]
}
