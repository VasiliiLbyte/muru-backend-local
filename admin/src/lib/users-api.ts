import type { CreateCrmUserBody, CrmUserDto, PatchCrmUserBody } from '../types/admin-users'
import { ApiError, type ApiResponse, apiFetch } from './api'

const CRM_BASE = '/api/crm/users'

/** DELETE endpoints that return 204 with empty body (apiFetch always parses JSON). */
const apiFetchNoContent = async (path: string, init?: RequestInit): Promise<void> => {
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers,
  })

  if (res.status === 204) return

  const text = await res.text()
  if (!text) {
    if (!res.ok) {
      if (res.status === 401) window.location.assign('/admin/login')
      throw new ApiError('Request failed', res.status)
    }
    return
  }

  const body = JSON.parse(text) as ApiResponse<unknown>
  if (!body.success) {
    if (res.status === 401 && !path.endsWith('/me')) {
      window.location.assign('/admin/login')
    }
    throw new ApiError(body.error.message, res.status, body.error.code)
  }
}

export const listUsers = () => apiFetch<CrmUserDto[]>(CRM_BASE)

export const createUser = (body: CreateCrmUserBody) =>
  apiFetch<CrmUserDto>(CRM_BASE, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const patchUser = (id: number, body: PatchCrmUserBody) =>
  apiFetch<CrmUserDto>(`${CRM_BASE}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

export const resetUserPassword = (id: number, password: string) =>
  apiFetch<{ ok: boolean }>(`${CRM_BASE}/${id}/password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  })

export const deleteUser = (id: number) =>
  apiFetchNoContent(`${CRM_BASE}/${id}`, { method: 'DELETE' })
