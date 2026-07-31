export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export type ApiOk<T> = { success: true; data: T; error: null }

export type ApiErr = {
  success: false
  data: null
  error: { message: string; code?: string; details?: unknown }
}

export type ApiResponse<T> = ApiOk<T> | ApiErr
