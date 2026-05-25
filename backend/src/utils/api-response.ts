import type { Response } from 'express'

import type { ApiErr, ApiErrorCode, ApiOk } from '../types/api-response'

export const ok = <T>(res: Response, data: T, status = 200) =>
  res.status(status).json({ success: true, data, error: null } satisfies ApiOk<T>)

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: ApiErrorCode,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export const fail = (
  res: Response,
  status: number,
  message: string,
  code?: ApiErrorCode,
  details?: unknown,
) =>
  res.status(status).json({
    success: false,
    data: null,
    error: { message, code, details },
  } satisfies ApiErr)

export const zodErrorMessage = (issues: { message: string }[]): string =>
  issues.map((issue) => issue.message).join('; ')
