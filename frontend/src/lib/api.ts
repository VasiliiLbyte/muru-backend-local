import type { CatalogNode, CatalogProduct, CatalogProductDetail } from '../types/catalog'
import type { CartItem, CheckoutForm, DraftOrder, OrderHistoryItem, ProfileData } from '../types/cart'
import type { FavoriteItem } from '../types/favorite'
import { getStoredToken } from './auth'

export type SyncApiResult = {
  totalRows: number
  syncedProducts: number
  skippedProducts: number
  skippedByRule?: number
  errors: Array<{ sku: string; reason: string }>
  warnings?: string[]
}

export type AdminCategoryRow = {
  id: number
  name: string
  slug: string
  coverDriveFilename: string | null
  coverImageUrl: string | null
}

export type CategoryCoverSyncApiResult = {
  updated: number
  skipped: number
  errors: Array<{ categoryId: number; slug: string; reason: string }>
  warnings?: string[]
}

export type SaveCategoryCoversApiResult = {
  saved: number
  validationErrors: string[]
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

const safeFetch = async (url: string, options?: RequestInit): Promise<Response> => {
  try {
    const response = await fetch(url, options)
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new Error('Сервер временно недоступен. Попробуйте позже.')
    }
    return response
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Нет соединения с сервером. Проверьте интернет.', { cause: error })
    }
    throw error
  }
}

const getAuthHeaders = (): HeadersInit => {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const triggerCatalogSync = async (telegramUserId: number): Promise<SyncApiResult> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/sync`, {
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

const adminTelegramHeaders = (telegramUserId: number): HeadersInit => ({
  'Content-Type': 'application/json',
  'x-telegram-user-id': String(telegramUserId),
  ...getAuthHeaders(),
})

export const fetchAdminCategories = async (telegramUserId: number): Promise<AdminCategoryRow[]> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/categories`, {
    headers: adminTelegramHeaders(telegramUserId),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to load admin categories')
  }
  return payload.data as AdminCategoryRow[]
}

export const saveAdminCategoryCovers = async (
  telegramUserId: number,
  items: Array<{ id: number; coverDriveFilename: string | null }>,
): Promise<SaveCategoryCoversApiResult> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/categories/covers`, {
    method: 'PUT',
    headers: adminTelegramHeaders(telegramUserId),
    body: JSON.stringify({ items }),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to save category covers')
  }
  return payload.data as SaveCategoryCoversApiResult
}

export const triggerCategoryCoverSync = async (telegramUserId: number): Promise<CategoryCoverSyncApiResult> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/sync/category-covers`, {
    method: 'POST',
    headers: adminTelegramHeaders(telegramUserId),
    body: JSON.stringify({ telegramUserId }),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Category cover sync failed')
  }
  return payload.data as CategoryCoverSyncApiResult
}

export const fetchCatalogTree = async (): Promise<CatalogNode[]> => {
  const response = await safeFetch(`${API_BASE_URL}/api/catalog/tree`)
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to load catalog tree')
  }
  return payload.data as CatalogNode[]
}

export const fetchCatalogProducts = async (params: {
  category?: string
  categorySlug?: string
  subcategory?: string
  subcategorySlug?: string
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
  const response = await safeFetch(`${API_BASE_URL}/api/catalog/products${query ? `?${query}` : ''}`)
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to load catalog products')
  }
  return payload.data as CatalogProduct[]
}

export const fetchCatalogProductBySku = async (sku: string): Promise<CatalogProductDetail> => {
  const response = await safeFetch(`${API_BASE_URL}/api/catalog/products/${encodeURIComponent(sku)}`)
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to load product detail')
  }
  return payload.data as CatalogProductDetail
}

export const notifyRestock = async (payloadBody: {
  telegramUserId: number
  sku: string
  productName: string
}): Promise<void> => {
  const response = await safeFetch(`${API_BASE_URL}/api/catalog/restock-notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(payloadBody),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to send restock notification')
  }
}

type DraftPayload = {
  telegramUserId: number
  items: CartItem[]
  deliveryMode: CheckoutForm['deliveryMode']
  deliveryOption?: string
  deliveryPrice?: number
  deliveryEta?: string
  address?: string
  comment?: string
  birthDate?: string
  promoCode?: string
}

export const fetchOrderDraft = async (telegramUserId: number): Promise<DraftOrder | null> => {
  const response = await safeFetch(`${API_BASE_URL}/api/orders/draft/${telegramUserId}`, {
    headers: getAuthHeaders(),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to load draft order')
  }
  return (payload.data as DraftOrder | null) ?? null
}

export const saveOrderDraft = async (payloadBody: DraftPayload): Promise<DraftOrder> => {
  const response = await safeFetch(`${API_BASE_URL}/api/orders/draft/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(payloadBody),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to save draft order')
  }
  return payload.data as DraftOrder
}

export const createOrder = async (payloadBody: DraftPayload): Promise<DraftOrder> => {
  const response = await safeFetch(`${API_BASE_URL}/api/orders/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(payloadBody),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to create order')
  }
  return payload.data as DraftOrder
}

export const fetchMyOrders = async (telegramUserId: number): Promise<OrderHistoryItem[]> => {
  const response = await safeFetch(`${API_BASE_URL}/api/orders/my?telegramUserId=${telegramUserId}`, {
    headers: getAuthHeaders(),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to load order history')
  }
  return payload.data as OrderHistoryItem[]
}

export const fetchMyProfile = async (telegramUserId: number): Promise<ProfileData> => {
  const response = await safeFetch(`${API_BASE_URL}/api/profile/me?telegramUserId=${telegramUserId}`, {
    headers: getAuthHeaders(),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to load profile')
  }
  return payload.data as ProfileData
}

export const saveMyProfile = async (payloadBody: ProfileData): Promise<ProfileData> => {
  const response = await safeFetch(`${API_BASE_URL}/api/profile/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(payloadBody),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to save profile')
  }
  return payload.data as ProfileData
}

export const fetchMyFavorites = async (telegramUserId: number): Promise<FavoriteItem[]> => {
  const response = await safeFetch(`${API_BASE_URL}/api/favorites/my?telegramUserId=${telegramUserId}`, {
    headers: getAuthHeaders(),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to load favorites')
  }
  return payload.data as FavoriteItem[]
}

export const addFavorite = async (telegramUserId: number, sku: string): Promise<void> => {
  const response = await safeFetch(`${API_BASE_URL}/api/favorites/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ telegramUserId, sku }),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to add favorite')
  }
}

export const removeFavorite = async (telegramUserId: number, sku: string): Promise<void> => {
  const response = await safeFetch(`${API_BASE_URL}/api/favorites/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ telegramUserId, sku }),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to remove favorite')
  }
}
