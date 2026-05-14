import type { Request, Response } from 'express'

import { listAdminCategories, saveCategoryCovers } from '../services/admin-categories.service'
import { syncCategoryCoversFromDrive } from '../services/category-cover-sync.service'
import { env } from '../utils/env'

const parseTelegramUserId = (req: Request): number | null => {
  const headerId = req.header('x-telegram-user-id')
  const bodyId = req.body?.telegramUserId
  const raw = headerId ?? bodyId
  const parsed = Number(raw)
  return Number.isInteger(parsed) ? parsed : null
}

const assertAdmin = (req: Request, res: Response): number | null => {
  const telegramUserId = parseTelegramUserId(req)
  if (!telegramUserId || !env.adminTelegramIds.includes(telegramUserId)) {
    res.status(403).json({
      success: false,
      data: null,
      error: 'Forbidden: admin access required',
    })
    return null
  }
  return telegramUserId
}

export const getAdminCategoriesHandler = async (req: Request, res: Response) => {
  if (!assertAdmin(req, res)) return
  try {
    const rows = await listAdminCategories()
    res.json({ success: true, data: rows, error: null })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load categories',
    })
  }
}

export const putAdminCategoryCoversHandler = async (req: Request, res: Response) => {
  if (!assertAdmin(req, res)) return
  try {
    const { saved, validationErrors } = await saveCategoryCovers(req.body)
    res.json({
      success: true,
      data: { saved, validationErrors },
      error: null,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to save covers',
    })
  }
}

export const postAdminCategoryCoverSyncHandler = async (req: Request, res: Response) => {
  if (!assertAdmin(req, res)) return
  try {
    const result = await syncCategoryCoversFromDrive()
    res.json({ success: true, data: result, error: null })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Category cover sync failed',
    })
  }
}
