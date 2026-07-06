export type ApiOk<T> = { success: true; data: T; error: null }

export type ApiErr = {
  success: false
  data: null
  error: { message: string; code?: string; details?: unknown }
}

export type ApiResponse<T> = ApiOk<T> | ApiErr

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

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

  const body = (await res.json()) as ApiResponse<T>
  if (!body.success) {
    if (res.status === 401 && !path.endsWith('/me')) {
      window.location.assign('/admin/login')
    }
    throw new ApiError(body.error.message, res.status, body.error.code)
  }

  return body.data
}
