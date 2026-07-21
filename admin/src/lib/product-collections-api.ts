import { apiFetch } from './api'

export type ProductCollectionsDto = {
  collectionIds: number[]
}

const pathForSku = (sku: string) =>
  `/api/crm/products/${encodeURIComponent(sku)}/collections`

export const getProductCollections = (sku: string) =>
  apiFetch<ProductCollectionsDto>(pathForSku(sku))

export const putProductCollections = (sku: string, collectionIds: number[]) =>
  apiFetch<ProductCollectionsDto>(pathForSku(sku), {
    method: 'PUT',
    body: JSON.stringify({ collectionIds }),
  })
