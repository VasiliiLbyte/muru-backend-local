import type { CatalogNode, CatalogProduct, CatalogProductDetail } from '../types/catalog'
import type { CartItem, CheckoutForm, DraftOrder, OrderHistoryItem, ProfileData } from '../types/cart'
import type { FavoriteItem } from '../types/favorite'
import { getViteApiBaseUrl } from './api-base-url'
import { apiErrorMessage, parseApi } from './api-response'
import { getStoredToken } from './auth'

export type { ApiResponse } from './api-response'

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

export type CatalogSyncHistoryItem = {
  id: number
  adminTelegramId: number
  status: 'success' | 'error'
  syncedProducts: number
  skippedProducts: number | null
  totalRows: number | null
  errorMessage: string | null
  finishedAt: string
  durationMs: number | null
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

export type BotWelcomeSettings = {
  welcomeCoverDriveFilename: string | null
  welcomeImageUrl: string | null
}

export type SaveBotWelcomeApiResult = {
  settings: BotWelcomeSettings
  resolveWarning: string | null
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

export type ApiHealthStatus = 'ok' | 'error'

export const fetchApiHealth = async (): Promise<ApiHealthStatus> => {
  try {
    const response = await safeFetch(`${API_BASE_URL}/api/health`)
    const payload = await response.json()
    if (!response.ok || !payload.success) return 'error'
    const status = (payload.data as { status?: string } | undefined)?.status
    return status === 'ok' ? 'ok' : 'error'
  } catch {
    return 'error'
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

  return parseApi<CatalogSyncJobState>(response)
}

export const fetchCatalogSyncHistory = async (
  telegramUserId: number,
  limit = 3,
): Promise<CatalogSyncHistoryItem[]> => {
  const response = await safeFetch(
    `${API_BASE_URL}/api/admin/sync/history?limit=${encodeURIComponent(String(limit))}`,
    {
      headers: {
        'x-telegram-user-id': String(telegramUserId),
      },
    },
  )

  const data = await parseApi<{ items: CatalogSyncHistoryItem[] }>(response)
  return data.items
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
    throw new Error(apiErrorMessage(payload, 'Sync request failed'))
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

const adminTelegramHeadersPatch = (telegramUserId: number): HeadersInit => ({
  'Content-Type': 'application/json',
  'x-telegram-user-id': String(telegramUserId),
})

export type AdminOrderListItem = {
  id: number
  telegramUserId: number
  status: string
  total: number
  deliveryMode: 'delivery' | 'pickup'
  address: string
  createdAt: string
  itemsCount: number
  customerName: string | null
  customerPhone: string | null
}

export type AdminOrderDetailItem = {
  sku: string
  name: string
  price: number
  quantity: number
  color?: string
  size?: string
  imageUrl?: string | null
}

export type AdminOrderDetail = AdminOrderListItem & {
  items: AdminOrderDetailItem[]
  comment: string
  adminComment: string
  deliveryOption: string | null
  deliveryPrice: number
  deliveryEta: string | null
  subtotal: number
  promoCode: string | null
  promoDiscount: number
  cdekSyncState: string
  cdekUuid: string | null
  cdekTrackNumber: string | null
  cdekStatus: string | null
  cdekStatusUpdatedAt: string | null
  cdekCreateError: string | null
}

export type PromoDiscountType = 'percent' | 'fixed'

export type PromoDisplayStatus = 'Активен' | 'Истёк' | 'Отключён'

export type AdminPromoCode = {
  id: number
  code: string
  discountType: PromoDiscountType
  discountValue: number
  minOrderAmount: number
  startsAt: string | null
  expiresAt: string | null
  usageLimit: number | null
  usageLimitPerUser: number
  usedCount: number
  isActive: boolean
  createdAt: string
  status: PromoDisplayStatus
}

export type AdminPromoCodeUsage = {
  id: number
  telegramUserId: number
  orderId: number | null
  usedAt: string
}

export type ValidateOrderPromoResult =
  | { valid: true; discountValue: number; discountType: PromoDiscountType; code: string }
  | { valid: false; reason: string }

export type CreateAdminPromoCodePayload = {
  code: string
  discountType: PromoDiscountType
  discountValue: number
  minOrderAmount?: number
  startsAt?: string | null
  expiresAt?: string | null
  usageLimit?: number | null
  usageLimitPerUser?: number
  isActive?: boolean
}

export type AdminOrdersListParams = {
  status?: string
  q?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export type AdminOrdersListResult = {
  items: AdminOrderListItem[]
  total: number
  page: number
  pageSize: number
  statusCounts: Record<string, number>
}

export const fetchAdminOrders = async (
  telegramUserId: number,
  params: AdminOrdersListParams = {},
): Promise<AdminOrdersListResult> => {
  const search = new URLSearchParams()
  if (params.status) search.set('status', params.status)
  if (params.q) search.set('q', params.q)
  if (params.dateFrom) search.set('dateFrom', params.dateFrom)
  if (params.dateTo) search.set('dateTo', params.dateTo)
  if (params.page) search.set('page', String(params.page))
  if (params.pageSize) search.set('pageSize', String(params.pageSize))

  const qs = search.toString()
  const url = `${API_BASE_URL}/api/admin/orders${qs ? `?${qs}` : ''}`
  const response = await safeFetch(url, {
    headers: adminTelegramHeadersGet(telegramUserId),
  })
  return parseApi<AdminOrdersListResult>(response)
}

export const fetchAdminOrderById = async (
  telegramUserId: number,
  orderId: number,
): Promise<AdminOrderDetail> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/orders/${orderId}`, {
    headers: adminTelegramHeadersGet(telegramUserId),
  })
  return parseApi<AdminOrderDetail>(response)
}

export const updateAdminOrder = async (
  telegramUserId: number,
  orderId: number,
  body: { status?: string; adminComment?: string; deliveryEta?: string | null },
): Promise<AdminOrderDetail> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/orders/${orderId}`, {
    method: 'PATCH',
    headers: adminTelegramHeadersPatch(telegramUserId),
    body: JSON.stringify(body),
  })
  return parseApi<AdminOrderDetail>(response)
}

export const restockAdminOrder = async (
  telegramUserId: number,
  orderId: number,
): Promise<AdminOrderDetail> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/orders/${orderId}/restock`, {
    method: 'POST',
    headers: adminTelegramHeadersPost(telegramUserId),
    body: JSON.stringify({}),
  })
  return parseApi<AdminOrderDetail>(response)
}

export const retryCdekForOrder = async (
  telegramUserId: number,
  orderId: number,
): Promise<{ uuid: string | null }> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/orders/${orderId}/cdek-retry`, {
    method: 'POST',
    headers: adminTelegramHeadersPost(telegramUserId),
    body: JSON.stringify({}),
  })
  return parseApi<{ uuid: string | null }>(response)
}

export const refreshCdekTrack = async (
  telegramUserId: number,
  orderId: number,
): Promise<{ scheduled: boolean; trackNumber: string | null }> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/orders/${orderId}/cdek-refresh`, {
    method: 'POST',
    headers: adminTelegramHeadersPost(telegramUserId),
    body: JSON.stringify({}),
  })
  return parseApi<{ scheduled: boolean; trackNumber: string | null }>(response)
}

export type AdminProductDimsRow = {
  sku: string
  name: string
  dimensions_label: string
  weight_grams: number
  weight_source: 'auto' | 'manual'
  dim_length_cm: number
  dim_width_cm: number
  dim_height_cm: number
  dims_source: 'auto' | 'manual'
  image_url_1: string
}

export const fetchAdminProductDims = async (
  telegramUserId: number,
  q: string,
  filter: string,
): Promise<AdminProductDimsRow[]> => {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (filter) params.set('filter', filter)
  const qs = params.toString()
  const response = await safeFetch(
    `${API_BASE_URL}/api/admin/products/dims${qs ? `?${qs}` : ''}`,
    { headers: adminTelegramHeadersGet(telegramUserId) },
  )
  return parseApi<AdminProductDimsRow[]>(response)
}

export const updateAdminProductDims = async (
  telegramUserId: number,
  sku: string,
  data: { weightGrams: number; lengthCm: number; widthCm: number; heightCm: number },
): Promise<{ sku: string; weightGrams: number; lengthCm: number; widthCm: number; heightCm: number }> => {
  const response = await safeFetch(
    `${API_BASE_URL}/api/admin/products/${encodeURIComponent(sku)}/dims`,
    {
      method: 'PATCH',
      headers: adminTelegramHeadersPatch(telegramUserId),
      body: JSON.stringify(data),
    },
  )
  return parseApi(response)
}

export const resetAdminProductDims = async (
  telegramUserId: number,
  sku: string,
): Promise<{ sku: string; reset: boolean }> => {
  const response = await safeFetch(
    `${API_BASE_URL}/api/admin/products/${encodeURIComponent(sku)}/dims`,
    {
      method: 'PATCH',
      headers: adminTelegramHeadersPatch(telegramUserId),
      body: JSON.stringify({ resetToAuto: true }),
    },
  )
  return parseApi(response)
}

export const fetchAdminPromoCodes = async (telegramUserId: number): Promise<AdminPromoCode[]> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/promo-codes`, {
    headers: adminTelegramHeadersGet(telegramUserId),
  })
  return parseApi<AdminPromoCode[]>(response)
}

export const createAdminPromoCode = async (
  telegramUserId: number,
  body: CreateAdminPromoCodePayload,
): Promise<AdminPromoCode> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/promo-codes`, {
    method: 'POST',
    headers: adminTelegramHeadersPost(telegramUserId),
    body: JSON.stringify(body),
  })
  return parseApi<AdminPromoCode>(response)
}

export const patchAdminPromoCode = async (
  telegramUserId: number,
  id: number,
  body: Partial<CreateAdminPromoCodePayload>,
): Promise<AdminPromoCode> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/promo-codes/${id}`, {
    method: 'PATCH',
    headers: adminTelegramHeadersPatch(telegramUserId),
    body: JSON.stringify(body),
  })
  return parseApi<AdminPromoCode>(response)
}

export const deleteAdminPromoCode = async (telegramUserId: number, id: number): Promise<void> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/promo-codes/${id}`, {
    method: 'DELETE',
    headers: adminTelegramHeadersGet(telegramUserId),
  })
  await parseApi<null>(response)
}

export const fetchAdminPromoCodeUsages = async (
  telegramUserId: number,
  promoCodeId: number,
): Promise<AdminPromoCodeUsage[]> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/promo-codes/${promoCodeId}/usages`, {
    headers: adminTelegramHeadersGet(telegramUserId),
  })
  return parseApi<AdminPromoCodeUsage[]>(response)
}

export const validateOrderPromo = async (body: {
  code: string
  subtotal: number
}): Promise<ValidateOrderPromoResult> => {
  const response = await safeFetch(`${API_BASE_URL}/api/orders/promo/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body),
  })
  return parseApi<ValidateOrderPromoResult>(response)
}

export const fetchBotWelcomeSettings = async (telegramUserId: number): Promise<BotWelcomeSettings> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/bot-welcome`, {
    headers: adminTelegramHeadersGet(telegramUserId),
  })
  return parseApi<BotWelcomeSettings>(response)
}

export const saveBotWelcomeSettings = async (
  telegramUserId: number,
  body: { welcomeCoverDriveFilename: string | null },
): Promise<SaveBotWelcomeApiResult> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/bot-welcome`, {
    method: 'PUT',
    headers: adminTelegramHeadersPost(telegramUserId),
    body: JSON.stringify(body),
  })
  return parseApi<SaveBotWelcomeApiResult>(response)
}

export const fetchAdminCategories = async (telegramUserId: number): Promise<AdminCategoryRow[]> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/categories`, {
    headers: adminTelegramHeadersGet(telegramUserId),
  })
  return parseApi<AdminCategoryRow[]>(response)
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
  return parseApi<SaveCategoryCoversApiResult>(response)
}

export const fetchCategoryCoverSyncStatus = async (
  telegramUserId: number,
): Promise<CategoryCoverSyncJobState> => {
  const response = await safeFetch(`${API_BASE_URL}/api/admin/sync/category-covers/status`, {
    headers: adminTelegramHeadersGet(telegramUserId),
  })
  return parseApi<CategoryCoverSyncJobState>(response)
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
    throw new Error(apiErrorMessage(payload, 'Category cover sync failed'))
  }

  return payload.data as CategoryCoverSyncApiResult
}

export const fetchCatalogTree = async (): Promise<CatalogNode[]> => {
  const response = await safeFetch(`${API_BASE_URL}/api/catalog/tree`)
  return parseApi<CatalogNode[]>(response)
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
  return parseApi<CatalogProduct[]>(response)
}

export const fetchCatalogProductBySku = async (sku: string): Promise<CatalogProductDetail> => {
  const response = await safeFetch(`${API_BASE_URL}/api/catalog/products/${encodeURIComponent(sku)}`)
  return parseApi<CatalogProductDetail>(response)
}

export type CdekCity = { code: number; full_name: string; city: string; region: string }
export type CdekPvz = {
  code: string
  name: string
  address: string
  workTime: string
  phones: string[]
  location: { latitude: number; longitude: number }
  weightMax?: number
  note?: string
}
export type CdekTariffOption = {
  tariffCode: number
  deliverySum: number
  periodMin: number
  periodMax: number
} | null
export type CdekCalcResult = { door: CdekTariffOption; pvz: CdekTariffOption; errors: string[] }

export const fetchCdekCities = async (q: string): Promise<CdekCity[]> => {
  if (q.trim().length < 2) return []
  const response = await safeFetch(
    `${API_BASE_URL}/api/cdek/cities?q=${encodeURIComponent(q)}`,
  )
  return parseApi<CdekCity[]>(response)
}

export type AddressSuggestion = {
  value: string
  street?: string
  house?: string
  block?: string
  flat?: string
  postalCode?: string
  cityFiasId?: string
}

export const fetchAddressSuggestions = async (
  q: string,
  city?: string,
): Promise<AddressSuggestion[]> => {
  if (q.trim().length < 2) return []
  const params = new URLSearchParams({ q })
  if (city) params.set('city', city)
  const response = await safeFetch(`${API_BASE_URL}/api/cdek/address-suggest?${params.toString()}`)
  return parseApi<AddressSuggestion[]>(response)
}

export const fetchCdekPvz = async (cityCode: number): Promise<CdekPvz[]> => {
  const response = await safeFetch(
    `${API_BASE_URL}/api/cdek/pickup-points?cityCode=${cityCode}`,
  )
  return parseApi<CdekPvz[]>(response)
}

export const calculateCdek = async (input: {
  toCityCode: number
  items: Array<{ sku: string; quantity: number }>
}): Promise<CdekCalcResult> => {
  const response = await safeFetch(`${API_BASE_URL}/api/cdek/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(input),
  })
  return parseApi<CdekCalcResult>(response)
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
  await parseApi<null>(response)
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
  cdekTariffCode?: number
  cdekCityCode?: number
  cdekCityName?: string
  cdekPvzCode?: string | null
  cdekPvzAddress?: string | null
  recipientName?: string
  recipientPhone?: string
}

export const fetchOrderDraft = async (telegramUserId: number): Promise<DraftOrder | null> => {
  const response = await safeFetch(`${API_BASE_URL}/api/orders/draft/${telegramUserId}`, {
    headers: getAuthHeaders(),
  })
  const data = await parseApi<DraftOrder | null>(response)
  return data ?? null
}

export const saveOrderDraft = async (payloadBody: DraftPayload): Promise<DraftOrder> => {
  const response = await safeFetch(`${API_BASE_URL}/api/orders/draft/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(payloadBody),
  })
  return parseApi<DraftOrder>(response)
}

export const createOrder = async (payloadBody: DraftPayload): Promise<DraftOrder> => {
  const response = await safeFetch(`${API_BASE_URL}/api/orders/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(payloadBody),
  })
  return parseApi<DraftOrder>(response)
}

export const fetchMyOrders = async (telegramUserId: number): Promise<OrderHistoryItem[]> => {
  const response = await safeFetch(`${API_BASE_URL}/api/orders/my?telegramUserId=${telegramUserId}`, {
    headers: getAuthHeaders(),
  })
  return parseApi<OrderHistoryItem[]>(response)
}

export const fetchMyProfile = async (telegramUserId: number): Promise<ProfileData> => {
  const response = await safeFetch(`${API_BASE_URL}/api/profile/me?telegramUserId=${telegramUserId}`, {
    headers: getAuthHeaders(),
  })
  return parseApi<ProfileData>(response)
}

export const saveMyProfile = async (payloadBody: ProfileData): Promise<ProfileData> => {
  const response = await safeFetch(`${API_BASE_URL}/api/profile/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(payloadBody),
  })
  return parseApi<ProfileData>(response)
}

export const fetchMyFavorites = async (telegramUserId: number): Promise<FavoriteItem[]> => {
  const response = await safeFetch(`${API_BASE_URL}/api/favorites/my?telegramUserId=${telegramUserId}`, {
    headers: getAuthHeaders(),
  })
  return parseApi<FavoriteItem[]>(response)
}

export const addFavorite = async (telegramUserId: number, sku: string): Promise<void> => {
  const response = await safeFetch(`${API_BASE_URL}/api/favorites/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ telegramUserId, sku }),
  })
  await parseApi<null>(response)
}

export const removeFavorite = async (telegramUserId: number, sku: string): Promise<void> => {
  const response = await safeFetch(`${API_BASE_URL}/api/favorites/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ telegramUserId, sku }),
  })
  await parseApi<null>(response)
}
