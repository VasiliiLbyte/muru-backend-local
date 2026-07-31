import { ApiError } from './api-error'
import { parseApiJson } from './parse-api-json'

export type { ApiOk, ApiErr, ApiResponse } from './api-error'
export { ApiError }

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers,
  })

  const body = await parseApiJson<T>(res)
  if (!body.success) {
    if (res.status === 401 && !path.endsWith('/me')) {
      window.location.assign('/admin/login')
    }
    throw new ApiError(body.error.message, res.status, body.error.code)
  }

  return body.data
}
