import { Router } from 'express'

import { syncCatalogFromGoogle } from '../services/google-sync'
import { env } from '../utils/env'

const adminRouter = Router()

const parseTelegramUserId = (
  headerValue: string | undefined,
  bodyValue: unknown,
): number | null => {
  const raw = headerValue ?? bodyValue
  const parsed = Number(raw)
  return Number.isInteger(parsed) ? parsed : null
}

adminRouter.post('/sync', async (req, res) => {
  const telegramUserId = parseTelegramUserId(req.header('x-telegram-user-id'), req.body?.telegramUserId)
  if (!telegramUserId || !env.adminTelegramIds.includes(telegramUserId)) {
    return res.status(403).json({
      success: false,
      data: null,
      error: 'Forbidden: admin access required',
    })
  }

  try {
    const result = await syncCatalogFromGoogle()
    return res.json({
      success: true,
      data: result,
      error: null,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Sync failed',
    })
  }
})

export { adminRouter }
