import type {
  CrmStockMovementsListParams,
  CrmStockMovementsListResult,
} from '../types/stock'
import { apiFetch } from './api'

const CRM_BASE = '/api/crm/stock/movements'

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

export const listStockMovements = (params: CrmStockMovementsListParams = {}) =>
  apiFetch<CrmStockMovementsListResult>(`${CRM_BASE}${buildQuery(params)}`)
