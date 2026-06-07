import type { NextFunction, Request, Response } from 'express'

import { env } from '../utils/env'
import { fail } from '../utils/api-response'
import type { AuthenticatedRequest } from './auth.middleware'

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const telegramId = (req as AuthenticatedRequest).auth?.telegramId
  if (!telegramId) {
    return fail(res, 403, 'Forbidden: admin access required', 'FORBIDDEN')
  }

  if (!env.adminTelegramIds.includes(telegramId)) {
    return fail(res, 403, 'Forbidden: admin access required', 'FORBIDDEN')
  }

  req.headers['x-telegram-user-id'] = String(telegramId)
  next()
}
