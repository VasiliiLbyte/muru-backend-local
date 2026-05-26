import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

import { CdekApiError } from '../services/cdek/client'
import { PromoValidationError } from '../services/promo.service'
import { HttpError } from '../utils/api-response'

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { message: 'Validation failed', code: 'VALIDATION', details: err.issues },
    })
  }

  if (err instanceof PromoValidationError) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'VALIDATION' },
    })
  }

  if (err instanceof CdekApiError) {
    return res.status(502).json({
      success: false,
      data: null,
      error: { message: err.message, code: 'UPSTREAM' },
    })
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      success: false,
      data: null,
      error: { message: err.message, code: err.code, details: err.details },
    })
  }

  const message = err instanceof Error ? err.message : 'Internal server error'
  console.error('[unhandled]', { url: req.originalUrl, method: req.method, err })
  return res.status(500).json({
    success: false,
    data: null,
    error: { message, code: 'INTERNAL' },
  })
}
