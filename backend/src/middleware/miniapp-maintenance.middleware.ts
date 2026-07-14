import type { NextFunction, Request, Response } from 'express'

import { resolveTelegramUserFromInitData } from '../services/telegram-auth.service'
import { env } from '../utils/env'

const MAINTENANCE_BODY = {
  ok: false as const,
  code: 'MAINTENANCE' as const,
  message: 'Магазин временно закрыт',
}

export const sendMaintenanceResponse = (res: Response) =>
  res.status(503).json(MAINTENANCE_BODY)

const resolveRequestTelegramUserId = (req: Request): number | null => {
  const initData = req.header('x-telegram-init-data')?.trim()
  if (!initData) return null
  const user = resolveTelegramUserFromInitData(initData)
  return user?.id ?? null
}

const isAdminTelegramUser = (telegramUserId: number | null): boolean =>
  Boolean(telegramUserId && env.adminTelegramIds.includes(telegramUserId))

/**
 * Blocks mini-app shopper API during maintenance. Admins (ADMIN_TELEGRAM_IDS) pass through.
 */
export const miniappMaintenanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!env.maintenanceMode) {
    return next()
  }

  const telegramUserId = resolveRequestTelegramUserId(req)
  if (isAdminTelegramUser(telegramUserId)) {
    return next()
  }

  return sendMaintenanceResponse(res)
}

/** Skips storefront web payment routes under /api/payments. */
export const miniappMaintenanceUnlessWebPayments = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.path.startsWith('/web')) {
    return next()
  }
  return miniappMaintenanceMiddleware(req, res, next)
}
