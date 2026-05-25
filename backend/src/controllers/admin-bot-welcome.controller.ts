import type { NextFunction, Request, Response } from 'express'

import { getBotWelcomeSettings, updateBotWelcomeCoverFilename } from '../services/bot-welcome.service'
import { env } from '../utils/env'
import { fail, ok } from '../utils/api-response'

const parseTelegramUserId = (req: Request): number | null => {
  const headerId = req.header('x-telegram-user-id')
  const bodyId = req.body?.telegramUserId
  const raw = headerId ?? bodyId
  const parsed = Number(raw)
  return Number.isInteger(parsed) ? parsed : null
}

const assertAdmin = (req: Request, res: Response): boolean => {
  const telegramUserId = parseTelegramUserId(req)
  if (!telegramUserId || !env.adminTelegramIds.includes(telegramUserId)) {
    fail(res, 403, 'Forbidden: admin access required', 'FORBIDDEN')
    return false
  }
  return true
}

export const getAdminBotWelcomeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertAdmin(req, res)) return
    const settings = await getBotWelcomeSettings()
    return ok(res, settings)
  } catch (error) {
    next(error)
  }
}

export const putAdminBotWelcomeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertAdmin(req, res)) return
    const result = await updateBotWelcomeCoverFilename(req.body)
    if (result.validationError) {
      return fail(res, 400, result.validationError, 'VALIDATION', {
        settings: result.settings,
        resolveWarning: result.resolveWarning,
      })
    }
    return ok(res, {
      settings: result.settings,
      resolveWarning: result.resolveWarning,
    })
  } catch (error) {
    next(error)
  }
}
