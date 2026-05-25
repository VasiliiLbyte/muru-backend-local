import type { NextFunction, Request, Response } from 'express'

import { verifyJwt } from '../services/jwt.service'
import { fail } from '../utils/api-response'

export type AuthenticatedRequest = Request & {
  auth?: {
    userId: number
    telegramId: number
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return fail(res, 401, 'Authorization token is required', 'UNAUTHORIZED')
  }

  const token = authHeader.slice('Bearer '.length).trim()
  const payload = verifyJwt(token)
  if (!payload) {
    return fail(res, 401, 'Invalid or expired token', 'UNAUTHORIZED')
  }

  ;(req as AuthenticatedRequest).auth = {
    userId: payload.userId,
    telegramId: payload.telegramId,
  }

  next()
}
