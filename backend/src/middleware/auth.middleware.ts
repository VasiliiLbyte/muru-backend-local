import type { NextFunction, Request, Response } from 'express'

import { verifyJwt } from '../services/jwt.service'

export type AuthenticatedRequest = Request & {
  auth?: {
    userId: number
    telegramId: number
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authorization token is required' })
  }

  const token = authHeader.slice('Bearer '.length).trim()
  const payload = verifyJwt(token)
  if (!payload) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }

  ;(req as AuthenticatedRequest).auth = {
    userId: payload.userId,
    telegramId: payload.telegramId,
  }

  next()
}
