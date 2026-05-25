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
