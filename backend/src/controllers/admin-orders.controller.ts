import type { Request, Response } from 'express'
import { z } from 'zod'

import {
  getAdminOrderById,
  listAdminOrders,
  restockAdminOrder,
  shouldNotifyConfirmed,
  updateAdminOrder,
  adminOrderDetailToOrderDraft,
} from '../services/admin-orders.service'
import { notifyClientStatusChange } from '../services/order-notifications.service'
import { env } from '../utils/env'

const parseTelegramUserId = (req: Request): number | null => {
  const raw = req.header('x-telegram-user-id') ?? req.body?.telegramUserId
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

const parseOrderId = (req: Request, res: Response): number | null => {
  const parsed = Number(req.params.id)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    res.status(400).json({ success: false, data: null, error: 'Invalid order id' })
    return null
  }
  return parsed
}

const patchBodySchema = z.object({
  status: z.string().min(1).optional(),
  adminComment: z.string().optional(),
  deliveryEta: z.string().nullable().optional(),
})

export const listAdminOrdersHandler = async (req: Request, res: Response) => {
  if (!assertAdmin(req, res)) return

  try {
    const data = await listAdminOrders({
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
      dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
      page: req.query.page,
      pageSize: req.query.pageSize,
    })
    res.json({ success: true, data, error: null })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to list orders',
    })
  }
}

export const getAdminOrderByIdHandler = async (req: Request, res: Response) => {
  if (!assertAdmin(req, res)) return
  const orderId = parseOrderId(req, res)
  if (orderId == null) return

  try {
    const order = await getAdminOrderById(orderId)
    if (!order) {
      res.status(404).json({ success: false, data: null, error: 'Order not found' })
      return
    }
    res.json({ success: true, data: order, error: null })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load order',
    })
  }
}

export const patchAdminOrderHandler = async (req: Request, res: Response) => {
  const managerTelegramId = assertAdmin(req, res)
  if (managerTelegramId == null) return

  const orderId = parseOrderId(req, res)
  if (orderId == null) return

  const parsed = patchBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      data: null,
      error: parsed.error.issues.map((i) => i.message).join('; '),
    })
    return
  }

  if (
    parsed.data.status === undefined &&
    parsed.data.adminComment === undefined &&
    parsed.data.deliveryEta === undefined
  ) {
    res.status(400).json({ success: false, data: null, error: 'No fields to update' })
    return
  }

  try {
    const result = await updateAdminOrder(
      orderId,
      {
        status: parsed.data.status,
        adminComment: parsed.data.adminComment,
        deliveryEta: parsed.data.deliveryEta,
      },
      managerTelegramId,
    )

    if (!result) {
      res.status(404).json({ success: false, data: null, error: 'Order not found' })
      return
    }

    const newStatus = parsed.data.status ?? result.order.status
    if (shouldNotifyConfirmed(result.previousStatus, newStatus)) {
      void notifyClientStatusChange(adminOrderDetailToOrderDraft(result.order), newStatus).catch(
        (err) => {
          console.error('[notify-client-status:error]', err)
        },
      )
    }

    res.json({ success: true, data: result.order, error: null })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to update order',
    })
  }
}

export const restockAdminOrderHandler = async (req: Request, res: Response) => {
  if (!assertAdmin(req, res)) return
  const orderId = parseOrderId(req, res)
  if (orderId == null) return

  try {
    const order = await restockAdminOrder(orderId)
    res.json({ success: true, data: order, error: null })
  } catch (error) {
    const statusCode =
      error instanceof Error && (error as Error & { statusCode?: number }).statusCode === 409
        ? 409
        : 500
    res.status(statusCode).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to restock order',
    })
  }
}
