import type {
  CrmOrderDetail,
  CrmOrderPatchBody,
  CrmOrdersListParams,
  CrmOrdersListResult,
} from '../types/orders'
import { apiFetch } from './api'

const CRM_BASE = '/api/crm/orders'

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

export const listOrders = (params: CrmOrdersListParams = {}) =>
  apiFetch<CrmOrdersListResult>(`${CRM_BASE}${buildQuery(params)}`)

export const getOrder = (id: number) => apiFetch<CrmOrderDetail>(`${CRM_BASE}/${id}`)

export const patchOrder = (id: number, body: CrmOrderPatchBody) =>
  apiFetch<CrmOrderDetail>(`${CRM_BASE}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

export const cancelOrder = (id: number) =>
  apiFetch<CrmOrderDetail>(`${CRM_BASE}/${id}/cancel`, { method: 'POST' })
