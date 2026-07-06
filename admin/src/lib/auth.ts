import { apiFetch } from './api'

export type AdminRole = 'owner' | 'manager'

export type AdminMe = {
  email: string
  role: AdminRole
}

export const login = (email: string, password: string) =>
  apiFetch<AdminMe>('/api/admin-auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

export const logout = () =>
  apiFetch<{ ok: true }>('/api/admin-auth/logout', {
    method: 'POST',
  })

export const fetchMe = () => apiFetch<AdminMe>('/api/admin-auth/me')
