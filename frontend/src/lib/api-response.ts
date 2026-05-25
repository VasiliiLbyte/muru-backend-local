export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'UPSTREAM'
  | 'INTERNAL'

export type ApiOk<T> = { success: true; data: T; error: null }

export type ApiErr = {
  success: false
  data: null
  error: { message: string; code?: ApiErrorCode; details?: unknown }
}

export type ApiResponse<T> = ApiOk<T> | ApiErr

export type ApiErrorCause = {
  code?: ApiErrorCode
  details?: unknown
  status: number
}

export const apiErrorMessage = (payload: unknown, fallback: string): string => {
  if (typeof payload !== 'object' || payload === null) return fallback
  const record = payload as Record<string, unknown>
  if (record.success === false) {
    const err = record.error
    if (typeof err === 'object' && err !== null && typeof (err as { message?: string }).message === 'string') {
      return (err as { message: string }).message
    }
    if (typeof err === 'string') return err
  }
  return fallback
}

export async function parseApi<T>(response: Response): Promise<T> {
  const text = await response.text()
  let payload: ApiResponse<T>
  try {
    payload = JSON.parse(text) as ApiResponse<T>
  } catch {
    throw new Error(
      response.ok ? 'Invalid JSON response' : text.trim() || `Request failed (${response.status})`,
      { cause: { status: response.status } satisfies Partial<ApiErrorCause> },
    )
  }

  if (!response.ok || !payload.success) {
    const message = apiErrorMessage(payload, `Request failed (${response.status})`)
    const code = !payload.success ? payload.error?.code : undefined
    const details = !payload.success ? payload.error?.details : undefined
    throw new Error(message, { cause: { code, details, status: response.status } satisfies ApiErrorCause })
  }

  return payload.data
}
