import type { NextFunction, Request, Response } from 'express'

import { syncCatalogFromGoogle } from '../services/google-sync'
import { env } from '../utils/env'
import { fail, ok } from '../utils/api-response'

const parseTelegramUserId = (req: Request): number | null => {
  const headerId = req.header('x-telegram-user-id')
  const bodyId = req.body?.telegramUserId
  const raw = headerId ?? bodyId
  const parsed = Number(raw)
  return Number.isInteger(parsed) ? parsed : null
}

export const syncCatalogHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const telegramUserId = parseTelegramUserId(req)
    if (!telegramUserId || !env.adminTelegramIds.includes(telegramUserId)) {
      return fail(res, 403, 'Forbidden: admin access required', 'FORBIDDEN')
    }

    const result = await syncCatalogFromGoogle()
    return ok(res, result)
  } catch (error) {
    next(error)
  }
}
