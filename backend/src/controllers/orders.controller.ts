import type { Request, Response } from 'express'
import { z } from 'zod'

import type { AuthenticatedRequest } from '../middleware/auth.middleware'
import { decreaseStockInSheets } from '../services/google-sheets-write.service'
import { env } from '../utils/env'
import { notifyAdminsByTelegram, notifyByEmail, notifyClientByTelegram } from '../services/order-notifications.service'
import { createOrder, getDraftOrderByTelegramUserId, getOrdersByTelegramUserId, saveDraftOrder } from '../services/orders.service'

const itemSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  color: z.string().optional(),
  size: z.string().optional(),
})

const draftPayloadSchema = z.object({
  telegramUserId: z.number().int().positive().optional(),
  items: z.array(itemSchema),
  deliveryMode: z.enum(['delivery', 'pickup']),
  deliveryOption: z.string().optional(),
  deliveryPrice: z.number().nonnegative().optional(),
  deliveryEta: z.string().optional(),
  address: z.string().optional(),
  comment: z.string().optional(),
  birthDate: z.string().optional(),
})

export const getDraftOrderHandler = async (req: Request, res: Response) => {
  const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId

  if (!telegramUserId) return res.status(401).json({ success: false, data: null, error: 'Unauthorized' })
  try {
    const draft = await getDraftOrderByTelegramUserId(telegramUserId)
    return res.json({ success: true, data: draft, error: null })
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load draft',
    })
  }
}

export const saveDraftOrderHandler = async (req: Request, res: Response) => {
  const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
  if (!telegramUserId) return res.status(401).json({ success: false, data: null, error: 'Unauthorized' })

  const parsed = draftPayloadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      data: null,
      error: parsed.error.issues.map((issue) => issue.message).join('; '),
    })
  }
  if (parsed.data.deliveryMode === 'delivery' && !parsed.data.address?.trim()) {
    return res.status(400).json({ success: false, data: null, error: 'Address is required for delivery' })
  }

  try {
    const draft = await saveDraftOrder({ ...parsed.data, telegramUserId })
    return res.json({ success: true, data: draft, error: null })
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to save draft',
    })
  }
}

export const createOrderHandler = async (req: Request, res: Response) => {
  const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
  if (!telegramUserId) return res.status(401).json({ success: false, data: null, error: 'Unauthorized' })

  const parsed = draftPayloadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      data: null,
      error: parsed.error.issues.map((issue) => issue.message).join('; '),
    })
  }
  if (parsed.data.items.length === 0) {
    return res.status(400).json({ success: false, data: null, error: 'Order items are required' })
  }
  if (parsed.data.deliveryMode === 'delivery' && !parsed.data.address?.trim()) {
    return res.status(400).json({ success: false, data: null, error: 'Address is required for delivery' })
  }

  try {
    const order = await createOrder({ ...parsed.data, telegramUserId })
    const stockUpdates = order.items.map((item) => ({
      sku: item.sku,
      quantity: item.quantity,
    }))

    if (env.enableSheetsStockWrite) {
      void decreaseStockInSheets(stockUpdates).catch((err) => {
        console.error('[sheets-write:error]', err)
      })
    } else {
      console.log(
        '[sheets-write] skipped (CATALOG_SOURCE=xlsx or ENABLE_SHEETS_STOCK_WRITE=false); stock is DB-only until next catalog sync',
      )
    }

    void notifyAdminsByTelegram(order).catch((notifyError) => {
      console.error('[telegram-order-notify:error]', notifyError)
    })
    void notifyClientByTelegram(order).catch((err) => {
      console.error('[telegram-client-notify:error]', err)
    })
    void notifyByEmail(order).catch((notifyError) => {
      console.error('[email-order-notify:error]', notifyError)
    })
    return res.json({ success: true, data: order, error: null })
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to create order',
    })
  }
}

export const getMyOrdersHandler = async (req: Request, res: Response) => {
  const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
  if (!telegramUserId) return res.status(401).json({ success: false, data: null, error: 'Unauthorized' })

  try {
    const orders = await getOrdersByTelegramUserId(telegramUserId)
    return res.json({
      success: true,
      data: orders,
      error: null,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load order history',
    })
  }
}
