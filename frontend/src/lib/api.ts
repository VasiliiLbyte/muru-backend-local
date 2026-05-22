import type { CatalogNode, CatalogProduct, CatalogProductDetail } from '../types/catalog'
import type { CartItem, CheckoutForm, DraftOrder, OrderHistoryItem, ProfileData } from '../types/cart'
import type { FavoriteItem } from '../types/favorite'
import { getViteApiBaseUrl } from './api-base-url'
import { getStoredToken } from './auth'

export type SyncErrorGroup = {
  reason: string
  count: number
  sampleSkus: string[]
}

export type CatalogSyncProgress = {
  phase: 'sheet' | 'drive' | 'database' | 'done'
  message: string
  foldersScanned?: number
  imagesSeen?: number
  processedProducts?: number
  totalProducts?: number
}

export type SyncApiResult = {
  totalRows: number
  syncedProducts: number
  skippedProducts: number
  skippedByRule?: number
  errors: Array<{ sku: string; reason: string }>
  warnings?: string[]
  errorGroups?: SyncErrorGroup[]
  durationMs?: number
  sheetTitle?: string
  driveFoldersScanned?: number
  driveImagesSeen?: number
  driveImagesMatched?: number
  driveSkusWithImages?: number
}

export type CatalogSyncJobState = {
  status: 'idle' | 'running' | 'success' | 'error'
  startedAt: string | null
  finishedAt: string | null
  result: SyncApiResult | null
  error: string | null
  progress: CatalogSyncProgress | null
}

const SYNC_POLL_INTERVAL_MS = 4000
const SYNC_POLL_TIMEOUT_MS = 10 * 60 * 1000

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const syncGatewayUnavailableMessage =
  'Ответ сервера не получен вовремя. Синхронизация может ещё выполняться — подождите 2–3 мин и нажмите «Обновить» или проверьте pm2 logs.'

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

export type CategoryCoverSyncProgress = {
  phase: 'lookup' | 'publish' | 'done'
  message: string
  foldersScanned?: number
  imagesSeen?: number
  resolvedCount?: number
  totalCategories?: number
}

export type CategoryCoverSyncJobState = {
  status: 'idle' | 'running' | 'success' | 'error'
  startedAt: string | null
  finishedAt: string | null
  result: CategoryCoverSyncApiResult | null
  error: string | null
  progress: CategoryCoverSyncProgress | null
}

const COVER_SYNC_POLL_INTERVAL_MS = 3000
const COVER_SYNC_POLL_TIMEOUT_MS = 10 * 60 * 1000

const coverSyncGatewayUnavailableMessage =
  'Ответ сервера не получен вовремя. Синхронизация обложек может ещё выполняться — подождите 1–2 мин и нажмите «Синхронизировать» снова или проверьте pm2 logs.'

export type SaveCategoryCoversApiResult = {
  saved: number
  validationErrors: string[]
}

const API_BASE_URL = getViteApiBaseUrl()

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
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('expected pattern') || msg.includes('Invalid URL')) {
      throw new Error(
        'Некорректный адрес API. Укажите в сборке VITE_API_BASE_URL полный URL (https://...), без пробелов и лишних символов.',
        { cause: error },
      )
    }
    throw error
  }
}

const getAuthHeaders = (): HeadersInit => {
  const raw = getStoredToken()
  if (!raw) return {}
  const token = raw.replace(/\r|\n/g, '').trim()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

export const fetchCatalogSyncStatus = async (telegramUserId: number): Promise<CatalogSyncJobState> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/sync/status`, {
    headers: {
      'x-telegram-user-id': String(telegramUserId),
    },
  })

  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to fetch sync status')
  }

  return payload.data as CatalogSyncJobState
}

const pollCatalogSyncUntilDone = async (
  telegramUserId: number,
  onProgress?: (progress: CatalogSyncProgress | null) => void,
): Promise<SyncApiResult> => {
  const deadline = Date.now() + SYNC_POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    await sleep(SYNC_POLL_INTERVAL_MS)
    const job = await fetchCatalogSyncStatus(telegramUserId)
    onProgress?.(job.progress)

    if (job.status === 'success' && job.result) {
      return job.result
    }
    if (job.status === 'error') {
      throw new Error(job.error ?? 'Sync failed')
    }
  }

  throw new Error(
    'Синхронизация занимает больше ожидаемого времени. Проверьте pm2 logs и повторите позже.',
  )
}

export const triggerCatalogSync = async (
  telegramUserId: number,
  onProgress?: (progress: CatalogSyncProgress | null) => void,
): Promise<SyncApiResult> => {
  let response: Response
  try {
    response = await safeFetch(`${API_BASE_URL}/api/admin/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-user-id': String(telegramUserId),
      },
      body: JSON.stringify({ telegramUserId }),
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Сервер временно недоступен')) {
      throw new Error(syncGatewayUnavailableMessage, { cause: error })
    }
    throw error
  }

  const payload = await response.json().catch(() => ({}))

  if (response.status === 202 && payload.success) {
    onProgress?.({ phase: 'sheet', message: 'Синхронизация запущена на сервере…' })
    return pollCatalogSyncUntilDone(telegramUserId, onProgress)
  }

  if (response.status === 409) {
    return pollCatalogSyncUntilDone(telegramUserId, onProgress)
  }

  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Sync request failed')
  }

  return payload.data as SyncApiResult
}

/** Admin catalog routes only check x-telegram-user-id; omit Authorization so a bad JWT cannot break WebKit fetch. */
const adminTelegramHeadersGet = (telegramUserId: number): HeadersInit => ({
  'x-telegram-user-id': String(telegramUserId),
})

/** Admin flag from backend ADMIN_TELEGRAM_IDS (not baked VITE_ADMIN_IDS). */
export const fetchAdminAccess = async (telegramUserId: number): Promise<boolean> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/me`, {
    headers: adminTelegramHeadersGet(telegramUserId),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    return false
  }
  return Boolean((payload.data as { isAdmin?: boolean } | null)?.isAdmin)
}

const adminTelegramHeadersPost = (telegramUserId: number): HeadersInit => ({
  'Content-Type': 'application/json',
  'x-telegram-user-id': String(telegramUserId),
})

export const fetchAdminCategories = async (telegramUserId: number): Promise<AdminCategoryRow[]> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/categories`, {
    headers: adminTelegramHeadersGet(telegramUserId),
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
    headers: adminTelegramHeadersPost(telegramUserId),
    body: JSON.stringify({ items }),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to save category covers')
  }
  return payload.data as SaveCategoryCoversApiResult
}

export const fetchCategoryCoverSyncStatus = async (
  telegramUserId: number,
): Promise<CategoryCoverSyncJobState> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/sync/category-covers/status`, {
    headers: adminTelegramHeadersGet(telegramUserId),
  })
  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to fetch category cover sync status')
  }
  return payload.data as CategoryCoverSyncJobState
}

const pollCategoryCoverSyncUntilDone = async (
  telegramUserId: number,
  onProgress?: (progress: CategoryCoverSyncProgress | null) => void,
): Promise<CategoryCoverSyncApiResult> => {
  const deadline = Date.now() + COVER_SYNC_POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    await sleep(COVER_SYNC_POLL_INTERVAL_MS)
    const job = await fetchCategoryCoverSyncStatus(telegramUserId)
    onProgress?.(job.progress)

    if (job.status === 'success' && job.result) {
      return job.result
    }
    if (job.status === 'error') {
      throw new Error(job.error ?? 'Category cover sync failed')
    }
  }

  throw new Error(
    'Синхронизация обложек занимает больше ожидаемого времени. Проверьте pm2 logs и повторите позже.',
  )
}

export const triggerCategoryCoverSync = async (
  telegramUserId: number,
  onProgress?: (progress: CategoryCoverSyncProgress | null) => void,
): Promise<CategoryCoverSyncApiResult> => {
  let response: Response
  try {
    response = await safeFetch(`${API_BASE_URL}/api/admin/sync/category-covers`, {
      method: 'POST',
      headers: adminTelegramHeadersPost(telegramUserId),
      body: JSON.stringify({ telegramUserId }),
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Сервер временно недоступен')) {
      throw new Error(coverSyncGatewayUnavailableMessage, { cause: error })
    }
    throw error
  }

  const payload = await response.json().catch(() => ({}))

  if (response.status === 202 && payload.success) {
    onProgress?.({ phase: 'lookup', message: 'Синхронизация запущена на сервере…' })
    return pollCategoryCoverSyncUntilDone(telegramUserId, onProgress)
  }

  if (response.status === 409) {
    return pollCategoryCoverSyncUntilDone(telegramUserId, onProgress)
  }

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
