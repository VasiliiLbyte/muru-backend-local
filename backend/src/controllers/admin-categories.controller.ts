import type { NextFunction, Request, Response } from 'express'

import { listAdminCategories, saveCategoryCovers } from '../services/admin-categories.service'
import { syncCategoryCoversFromDrive } from '../services/category-cover-sync.service'
import { env } from '../utils/env'
import { fail, ok } from '../utils/api-response'

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
    fail(res, 403, 'Forbidden: admin access required', 'FORBIDDEN')
    return null
  }
  return telegramUserId
}

export const getAdminCategoriesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertAdmin(req, res)) return
    const rows = await listAdminCategories()
    return ok(res, rows)
  } catch (error) {
    next(error)
  }
}

export const putAdminCategoryCoversHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertAdmin(req, res)) return
    const { saved, validationErrors } = await saveCategoryCovers(req.body)
    return ok(res, { saved, validationErrors })
  } catch (error) {
    next(error)
  }
}

export const postAdminCategoryCoverSyncHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertAdmin(req, res)) return
    const result = await syncCategoryCoversFromDrive()
    return ok(res, result)
  } catch (error) {
    next(error)
  }
}
