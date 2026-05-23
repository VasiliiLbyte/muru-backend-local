import { Router } from 'express'

import {
  getAdminCategoriesHandler,
  putAdminCategoryCoversHandler,
} from '../controllers/admin-categories.controller'
import {
  getAdminOrderByIdHandler,
  listAdminOrdersHandler,
  patchAdminOrderHandler,
  restockAdminOrderHandler,
} from '../controllers/admin-orders.controller'
import {
  getCategoryCoverSyncJobState,
  isCategoryCoverSyncRunning,
  startCategoryCoverSyncJob,
} from '../services/category-cover-sync-job-state'
import {
  getCatalogSyncJobState,
  isCatalogSyncRunning,
  startCatalogSyncJob,
} from '../services/sync-job-state'
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

const isAdminRequest = (req: { header: (name: string) => string | undefined; body?: { telegramUserId?: unknown } }): boolean => {
  const telegramUserId = parseTelegramUserId(req.header('x-telegram-user-id'), req.body?.telegramUserId)
  return Boolean(telegramUserId && env.adminTelegramIds.includes(telegramUserId))
}

adminRouter.get('/me', (req, res) => {
  return res.json({
    success: true,
    data: { isAdmin: isAdminRequest(req) },
    error: null,
  })
})

adminRouter.get('/orders', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({
      success: false,
      data: null,
      error: 'Forbidden: admin access required',
    })
  }
  return listAdminOrdersHandler(req, res)
})

adminRouter.get('/orders/:id', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({
      success: false,
      data: null,
      error: 'Forbidden: admin access required',
    })
  }
  return getAdminOrderByIdHandler(req, res)
})

adminRouter.patch('/orders/:id', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({
      success: false,
      data: null,
      error: 'Forbidden: admin access required',
    })
  }
  return patchAdminOrderHandler(req, res)
})

adminRouter.post('/orders/:id/restock', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({
      success: false,
      data: null,
      error: 'Forbidden: admin access required',
    })
  }
  return restockAdminOrderHandler(req, res)
})

adminRouter.get('/categories', getAdminCategoriesHandler)
adminRouter.put('/categories/covers', putAdminCategoryCoversHandler)
adminRouter.get('/sync/category-covers/status', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({
      success: false,
      data: null,
      error: 'Forbidden: admin access required',
    })
  }

  return res.json({
    success: true,
    data: getCategoryCoverSyncJobState(),
    error: null,
  })
})

adminRouter.post('/sync/category-covers', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({
      success: false,
      data: null,
      error: 'Forbidden: admin access required',
    })
  }

  if (isCategoryCoverSyncRunning()) {
    return res.status(409).json({
      success: false,
      data: getCategoryCoverSyncJobState(),
      error: 'Category cover sync is already running',
    })
  }

  const started = startCategoryCoverSyncJob()
  if (!started) {
    return res.status(409).json({
      success: false,
      data: getCategoryCoverSyncJobState(),
      error: 'Category cover sync is already running',
    })
  }

  return res.status(202).json({
    success: true,
    data: { accepted: true, status: 'running' },
    error: null,
  })
})

adminRouter.get('/sync/status', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({
      success: false,
      data: null,
      error: 'Forbidden: admin access required',
    })
  }

  return res.json({
    success: true,
    data: getCatalogSyncJobState(),
    error: null,
  })
})

adminRouter.post('/sync', async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({
      success: false,
      data: null,
      error: 'Forbidden: admin access required',
    })
  }

  if (isCatalogSyncRunning()) {
    return res.status(409).json({
      success: false,
      data: getCatalogSyncJobState(),
      error: 'Catalog sync is already running',
    })
  }

  const started = startCatalogSyncJob()
  if (!started) {
    return res.status(409).json({
      success: false,
      data: getCatalogSyncJobState(),
      error: 'Catalog sync is already running',
    })
  }

  return res.status(202).json({
    success: true,
    data: { accepted: true, status: 'running' },
    error: null,
  })
})

adminRouter.post('/sync/stock', async (req, res) => {
  if (!isAdminRequest(req)) {
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
      data: { message: 'Stock synced', ...result },
      error: null,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Stock sync failed',
    })
  }
})

export { adminRouter }
