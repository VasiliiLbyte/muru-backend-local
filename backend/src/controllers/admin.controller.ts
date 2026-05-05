import type { Request, Response } from 'express'

import { syncCatalogFromGoogle } from '../services/google-sync'
import { env } from '../utils/env'

const parseTelegramUserId = (req: Request): number | null => {
  const headerId = req.header('x-telegram-user-id')
  const bodyId = req.body?.telegramUserId
  const raw = headerId ?? bodyId
  const parsed = Number(raw)
  return Number.isInteger(parsed) ? parsed : null
}

export const syncCatalogHandler = async (req: Request, res: Response) => {
  const telegramUserId = parseTelegramUserId(req)
  if (!telegramUserId || !env.adminTelegramIds.includes(telegramUserId)) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: admin access required',
    })
  }

  try {
    const result = await syncCatalogFromGoogle()
    return res.json({ success: true, data: result })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Sync failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
