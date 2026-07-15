import type {
  BannerWriteInput,
  CollectionProductInput,
  CollectionWriteInput,
  ContentImage,
  CrmBannerDto,
  CrmCollectionDto,
  CrmLookbookDto,
  CrmLookbookHotspot,
  CrmPageDto,
  LookbookHotspotPatchInput,
  LookbookHotspotWriteInput,
  LookbookImageInput,
  LookbookWriteInput,
  PageWriteInput,
} from '../types/content'
import { ApiError, apiFetch, type ApiResponse } from './api'

const CRM_BASE = '/api/crm/content'

// Pages

export const listPages = () => apiFetch<CrmPageDto[]>(`${CRM_BASE}/pages`)

export const getPage = (id: string) => apiFetch<CrmPageDto>(`${CRM_BASE}/pages/${id}`)

export const createPage = (input: PageWriteInput) =>
  apiFetch<CrmPageDto>(`${CRM_BASE}/pages`, { method: 'POST', body: JSON.stringify(input) })

export const updatePage = (id: string, input: PageWriteInput) =>
  apiFetch<CrmPageDto>(`${CRM_BASE}/pages/${id}`, { method: 'PUT', body: JSON.stringify(input) })

export const deletePage = (id: string) =>
  apiFetch<{ ok: boolean }>(`${CRM_BASE}/pages/${id}`, { method: 'DELETE' })

// Collections

export const listCollections = () => apiFetch<CrmCollectionDto[]>(`${CRM_BASE}/collections`)

export const getCollection = (id: string) =>
  apiFetch<CrmCollectionDto>(`${CRM_BASE}/collections/${id}`)

export const createCollection = (input: CollectionWriteInput) =>
  apiFetch<CrmCollectionDto>(`${CRM_BASE}/collections`, {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const updateCollection = (id: string, input: CollectionWriteInput) =>
  apiFetch<CrmCollectionDto>(`${CRM_BASE}/collections/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })

export const deleteCollection = (id: string) =>
  apiFetch<{ ok: boolean }>(`${CRM_BASE}/collections/${id}`, { method: 'DELETE' })

export const setCollectionProducts = (id: string, products: CollectionProductInput[]) =>
  apiFetch<CrmCollectionDto>(`${CRM_BASE}/collections/${id}/products`, {
    method: 'PUT',
    body: JSON.stringify(products),
  })

// Lookbooks

export const listLookbooks = () => apiFetch<CrmLookbookDto[]>(`${CRM_BASE}/lookbooks`)

export const getLookbook = (id: string) => apiFetch<CrmLookbookDto>(`${CRM_BASE}/lookbooks/${id}`)

export const createLookbook = (input: LookbookWriteInput) =>
  apiFetch<CrmLookbookDto>(`${CRM_BASE}/lookbooks`, { method: 'POST', body: JSON.stringify(input) })

export const updateLookbook = (id: string, input: LookbookWriteInput) =>
  apiFetch<CrmLookbookDto>(`${CRM_BASE}/lookbooks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })

export const deleteLookbook = (id: string) =>
  apiFetch<{ ok: boolean }>(`${CRM_BASE}/lookbooks/${id}`, { method: 'DELETE' })

export const setLookbookImages = (id: string, images: LookbookImageInput[]) =>
  apiFetch<CrmLookbookDto>(`${CRM_BASE}/lookbooks/${id}/images`, {
    method: 'PUT',
    body: JSON.stringify(images),
  })

export const listLookbookHotspots = (lookbookId: string) =>
  apiFetch<CrmLookbookHotspot[]>(`${CRM_BASE}/lookbooks/${lookbookId}/hotspots`)

export const createLookbookHotspot = (lookbookId: string, body: LookbookHotspotWriteInput) =>
  apiFetch<CrmLookbookHotspot>(`${CRM_BASE}/lookbooks/${lookbookId}/hotspots`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const updateLookbookHotspot = (
  lookbookId: string,
  hotspotId: string,
  body: LookbookHotspotPatchInput,
) =>
  apiFetch<CrmLookbookHotspot>(
    `${CRM_BASE}/lookbooks/${lookbookId}/hotspots/${hotspotId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  )

export const deleteLookbookHotspot = (lookbookId: string, hotspotId: string) =>
  apiFetch<{ ok: boolean }>(`${CRM_BASE}/lookbooks/${lookbookId}/hotspots/${hotspotId}`, {
    method: 'DELETE',
  })

// Banners

export const listBanners = () => apiFetch<CrmBannerDto[]>(`${CRM_BASE}/banners`)

export const getBanner = (id: string) => apiFetch<CrmBannerDto>(`${CRM_BASE}/banners/${id}`)

export const createBanner = (input: BannerWriteInput) =>
  apiFetch<CrmBannerDto>(`${CRM_BASE}/banners`, { method: 'POST', body: JSON.stringify(input) })

export const updateBanner = (id: string, input: BannerWriteInput) =>
  apiFetch<CrmBannerDto>(`${CRM_BASE}/banners/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })

export const deleteBanner = (id: string) =>
  apiFetch<{ ok: boolean }>(`${CRM_BASE}/banners/${id}`, { method: 'DELETE' })

// Upload

export const uploadImage = async (file: File): Promise<ContentImage> => {
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${CRM_BASE}/upload`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })

  const body = (await res.json()) as ApiResponse<ContentImage>
  if (!body.success) {
    if (res.status === 401) {
      window.location.assign('/admin/login')
    }
    throw new ApiError(body.error.message, res.status, body.error.code)
  }

  return body.data
}
