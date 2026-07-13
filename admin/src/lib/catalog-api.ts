import type {
  CrmCatalogImageUpload,
  CrmCatalogImportResult,
  CrmCatalogListParams,
  CrmCatalogListResult,
  CrmCatalogMeta,
  CrmCatalogProductCreateBody,
  CrmCatalogProductDetail,
  CrmCatalogProductPatchBody,
  CrmCategoryCreateBody,
  CrmCategoryItem,
  CrmCategoryPatchBody,
  CrmCharacteristicCreateBody,
  CrmCharacteristicItem,
  CrmCharacteristicPatchBody,
  CrmRenameSubcategoryBody,
} from '../types/catalog'
import { ApiError, apiFetch, type ApiResponse } from './api'

const CRM_BASE = '/api/crm/catalog'

const buildQuery = (params: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      sp.set(key, String(value))
    }
  }
  const query = sp.toString()
  return query ? `?${query}` : ''
}

const parseFilename = (contentDisposition: string | null, fallback: string): string => {
  if (!contentDisposition) return fallback
  const match = /filename="([^"]+)"/i.exec(contentDisposition)
  return match?.[1] ?? fallback
}

export const getCatalogMeta = () => apiFetch<CrmCatalogMeta>(`${CRM_BASE}/meta`)

export const listProducts = (params: CrmCatalogListParams = {}) =>
  apiFetch<CrmCatalogListResult>(`${CRM_BASE}/products${buildQuery(params)}`)

export const getProduct = (id: number) =>
  apiFetch<CrmCatalogProductDetail>(`${CRM_BASE}/products/${id}`)

export const createProduct = (body: CrmCatalogProductCreateBody) =>
  apiFetch<CrmCatalogProductDetail>(`${CRM_BASE}/products`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const patchProduct = (id: number, body: CrmCatalogProductPatchBody) =>
  apiFetch<CrmCatalogProductDetail>(`${CRM_BASE}/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

export const archiveProduct = (id: number) =>
  apiFetch<CrmCatalogProductDetail>(`${CRM_BASE}/products/${id}/archive`, { method: 'POST' })

export const unarchiveProduct = (id: number) =>
  apiFetch<CrmCatalogProductDetail>(`${CRM_BASE}/products/${id}/unarchive`, { method: 'POST' })

export const updateProductStock = (id: number, inStock: number) =>
  apiFetch<CrmCatalogProductDetail>(`${CRM_BASE}/products/${id}/stock`, {
    method: 'PUT',
    body: JSON.stringify({ inStock }),
  })

export const listCategories = () =>
  apiFetch<{ items: CrmCategoryItem[] }>(`${CRM_BASE}/categories`)

export const createCategory = (body: CrmCategoryCreateBody) =>
  apiFetch<CrmCategoryItem>(`${CRM_BASE}/categories`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const patchCategory = (id: number, body: CrmCategoryPatchBody) =>
  apiFetch<CrmCategoryItem>(`${CRM_BASE}/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

export const deleteCategory = (id: number) =>
  apiFetch<{ deleted: boolean }>(`${CRM_BASE}/categories/${id}`, { method: 'DELETE' })

export const renameSubcategory = (body: CrmRenameSubcategoryBody) =>
  apiFetch<{ updatedCount: number }>(`${CRM_BASE}/categories/rename-subcategory`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const listCharacteristics = () =>
  apiFetch<{ items: CrmCharacteristicItem[] }>(`${CRM_BASE}/characteristics`)

export const createCharacteristic = (body: CrmCharacteristicCreateBody) =>
  apiFetch<CrmCharacteristicItem>(`${CRM_BASE}/characteristics`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const patchCharacteristic = (id: number, body: CrmCharacteristicPatchBody) =>
  apiFetch<CrmCharacteristicItem>(`${CRM_BASE}/characteristics/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

export const uploadCatalogImage = async (file: File): Promise<CrmCatalogImageUpload> => {
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${CRM_BASE}/upload-image`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })

  const body = (await res.json()) as ApiResponse<CrmCatalogImageUpload>
  if (!body.success) {
    if (res.status === 401) {
      window.location.assign('/admin/login')
    }
    throw new ApiError(body.error.message, res.status, body.error.code)
  }

  return body.data
}

export const importCatalog = async (
  file: File,
  dryRun: boolean,
): Promise<CrmCatalogImportResult> => {
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${CRM_BASE}/import?dryRun=${dryRun ? 'true' : 'false'}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })

  const body = (await res.json()) as ApiResponse<CrmCatalogImportResult>
  if (!body.success) {
    if (res.status === 401) {
      window.location.assign('/admin/login')
    }
    throw new ApiError(body.error.message, res.status, body.error.code)
  }

  return body.data
}

export const downloadExport = async (
  format: 'xlsx' | 'csv',
): Promise<{ blob: Blob; filename: string }> => {
  const res = await fetch(`${CRM_BASE}/export?format=${format}`, {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) {
      window.location.assign('/admin/login')
      throw new ApiError('Unauthorized', 401)
    }
    try {
      const body = (await res.json()) as ApiResponse<unknown>
      if (!body.success) {
        throw new ApiError(body.error.message, res.status, body.error.code)
      }
    } catch {
      throw new ApiError('Export failed', res.status)
    }
    throw new ApiError('Export failed', res.status)
  }

  const blob = await res.blob()
  const fallback = `muru-catalog.${format}`
  const filename = parseFilename(res.headers.get('Content-Disposition'), fallback)
  return { blob, filename }
}
