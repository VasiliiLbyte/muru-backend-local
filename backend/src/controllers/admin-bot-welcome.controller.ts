import type { Request, Response } from 'express'

import { getBotWelcomeSettings, updateBotWelcomeCoverFilename } from '../services/bot-welcome.service'
import { env } from '../utils/env'

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
    res.status(403).json({
      success: false,
      data: null,
      error: 'Forbidden: admin access required',
    })
    return false
  }
  return true
}

export const getAdminBotWelcomeHandler = async (req: Request, res: Response) => {
  if (!assertAdmin(req, res)) return
  try {
    const settings = await getBotWelcomeSettings()
    res.json({ success: true, data: settings, error: null })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load bot welcome settings',
    })
  }
}

export const putAdminBotWelcomeHandler = async (req: Request, res: Response) => {
  if (!assertAdmin(req, res)) return
  try {
    const result = await updateBotWelcomeCoverFilename(req.body)
    if (result.validationError) {
      return res.status(400).json({
        success: false,
        data: { settings: result.settings, resolveWarning: result.resolveWarning },
        error: result.validationError,
      })
    }
    res.json({
      success: true,
      data: {
        settings: result.settings,
        resolveWarning: result.resolveWarning,
      },
      error: null,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to save bot welcome settings',
    })
  }
}
