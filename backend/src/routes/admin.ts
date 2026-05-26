import type { Response } from 'express'
import { Router } from 'express'

import {
  createAdminPromoCodeHandler,
  deleteAdminPromoCodeHandler,
  listAdminPromoCodeUsagesHandler,
  listAdminPromoCodesHandler,
  patchAdminPromoCodeHandler,
} from '../controllers/admin-promo-codes.controller'
import {
  getAdminBotWelcomeHandler,
  putAdminBotWelcomeHandler,
} from '../controllers/admin-bot-welcome.controller'
import {
  getAdminCategoriesHandler,
  putAdminCategoryCoversHandler,
} from '../controllers/admin-categories.controller'
import {
  getAdminOrderByIdHandler,
  listAdminOrdersHandler,
  patchAdminOrderHandler,
  restockAdminOrderHandler,
  retryCdekOrderHandler,
} from '../controllers/admin-orders.controller'
import {
  getCategoryCoverSyncJobState,
  isCategoryCoverSyncRunning,
  startCategoryCoverSyncJob,
} from '../services/category-cover-sync-job-state'
import { listCatalogSyncHistory } from '../services/catalog-sync-history.service'
import { invalidateImageCache } from '../services/image-proxy.service'
import { isValidDriveFileId } from '../utils/drive-file-id'
import {
  getCatalogSyncJobState,
  isCatalogSyncRunning,
  startCatalogSyncJob,
} from '../services/sync-job-state'
import { syncCatalogFromGoogle } from '../services/google-sync'
import { env } from '../utils/env'
import { fail, ok } from '../utils/api-response'

const adminRouter = Router()

const parseTelegramUserId = (
  headerValue: string | undefined,
  bodyValue: unknown,
): number | null => {
  const raw = headerValue ?? bodyValue
  const parsed = Number(raw)
  return Number.isInteger(parsed) ? parsed : null
}

const isAdminRequest = (req: { header: (name: string) => string | undefined; body?: { telegramUserId?: unknown } }): boolean => {
  const telegramUserId = parseTelegramUserId(req.header('x-telegram-user-id'), req.body?.telegramUserId)
  return Boolean(telegramUserId && env.adminTelegramIds.includes(telegramUserId))
}

const adminForbidden = (res: Response) =>
  fail(res, 403, 'Forbidden: admin access required', 'FORBIDDEN')

adminRouter.get('/me', (req, res) => {
  return ok(res, { isAdmin: isAdminRequest(req) })
})

adminRouter.get('/orders', (req, res, next) => {
  if (!isAdminRequest(req)) return adminForbidden(res)
  return listAdminOrdersHandler(req, res, next)
})

adminRouter.get('/orders/:id', (req, res, next) => {
  if (!isAdminRequest(req)) return adminForbidden(res)
  return getAdminOrderByIdHandler(req, res, next)
})

adminRouter.patch('/orders/:id', (req, res, next) => {
  if (!isAdminRequest(req)) return adminForbidden(res)
  return patchAdminOrderHandler(req, res, next)
})

adminRouter.post('/orders/:id/restock', (req, res, next) => {
  if (!isAdminRequest(req)) return adminForbidden(res)
  return restockAdminOrderHandler(req, res, next)
})

adminRouter.post('/orders/:id/cdek-retry', (req, res, next) => {
  if (!isAdminRequest(req)) return adminForbidden(res)
  return retryCdekOrderHandler(req, res, next)
})

adminRouter.get('/categories', getAdminCategoriesHandler)
adminRouter.put('/categories/covers', putAdminCategoryCoversHandler)
adminRouter.get('/bot-welcome', getAdminBotWelcomeHandler)
adminRouter.put('/bot-welcome', putAdminBotWelcomeHandler)

adminRouter.get('/promo-codes', listAdminPromoCodesHandler)
adminRouter.post('/promo-codes', createAdminPromoCodeHandler)
adminRouter.patch('/promo-codes/:id', patchAdminPromoCodeHandler)
adminRouter.delete('/promo-codes/:id', deleteAdminPromoCodeHandler)
adminRouter.get('/promo-codes/:id/usages', listAdminPromoCodeUsagesHandler)

adminRouter.get('/sync/category-covers/status', (req, res) => {
  if (!isAdminRequest(req)) return adminForbidden(res)
  return ok(res, getCategoryCoverSyncJobState())
})

adminRouter.post('/sync/category-covers', (req, res) => {
  if (!isAdminRequest(req)) return adminForbidden(res)

  if (isCategoryCoverSyncRunning()) {
    return fail(res, 409, 'Category cover sync is already running', 'CONFLICT', getCategoryCoverSyncJobState())
  }

  const started = startCategoryCoverSyncJob()
  if (!started) {
    return fail(res, 409, 'Category cover sync is already running', 'CONFLICT', getCategoryCoverSyncJobState())
  }

  return ok(res, { accepted: true, status: 'running' }, 202)
})

adminRouter.post('/images/invalidate', async (req, res, next) => {
  if (!isAdminRequest(req)) return adminForbidden(res)

  const fileIds = Array.isArray(req.body?.fileIds)
    ? req.body.fileIds.filter((id: unknown) => typeof id === 'string' && isValidDriveFileId(id))
    : []

  if (fileIds.length === 0) {
    return fail(res, 400, 'fileIds must be a non-empty array of valid Drive file ids', 'VALIDATION')
  }

  try {
    await invalidateImageCache(fileIds)
    return ok(res, { invalidated: fileIds.length })
  } catch (error) {
    next(error)
  }
})

adminRouter.get('/sync/history', async (req, res, next) => {
  if (!isAdminRequest(req)) return adminForbidden(res)

  try {
    const items = await listCatalogSyncHistory(req.query.limit)
    return ok(res, { items })
  } catch (error) {
    next(error)
  }
})

adminRouter.get('/sync/status', (req, res) => {
  if (!isAdminRequest(req)) return adminForbidden(res)
  return ok(res, getCatalogSyncJobState())
})

adminRouter.post('/sync', (req, res) => {
  if (!isAdminRequest(req)) return adminForbidden(res)

  const telegramUserId = parseTelegramUserId(
    req.header('x-telegram-user-id'),
    req.body?.telegramUserId,
  )
  if (!telegramUserId) {
    return fail(res, 400, 'telegramUserId is required', 'VALIDATION')
  }

  if (isCatalogSyncRunning()) {
    return fail(res, 409, 'Catalog sync is already running', 'CONFLICT', getCatalogSyncJobState())
  }

  const started = startCatalogSyncJob(telegramUserId)
  if (!started) {
    return fail(res, 409, 'Catalog sync is already running', 'CONFLICT', getCatalogSyncJobState())
  }

  return ok(res, { accepted: true, status: 'running' }, 202)
})

adminRouter.post('/sync/stock', async (req, res, next) => {
  if (!isAdminRequest(req)) return adminForbidden(res)

  try {
    const result = await syncCatalogFromGoogle()
    return ok(res, { message: 'Stock synced', ...result })
  } catch (error) {
    next(error)
  }
})

export { adminRouter }
