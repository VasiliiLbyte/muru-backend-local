import type { NextFunction, Request, Response } from 'express'
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
import { fail, HttpError, ok, zodErrorMessage } from '../utils/api-response'

const parseTelegramUserId = (req: Request): number | null => {
  const raw = req.header('x-telegram-user-id') ?? req.body?.telegramUserId
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

const parseOrderId = (req: Request, res: Response): number | null => {
  const parsed = Number(req.params.id)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(res, 400, 'Invalid order id', 'VALIDATION')
    return null
  }
  return parsed
}

const patchBodySchema = z.object({
  status: z.string().min(1).optional(),
  adminComment: z.string().optional(),
  deliveryEta: z.string().nullable().optional(),
})

export const listAdminOrdersHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertAdmin(req, res)) return

    const data = await listAdminOrders({
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
      dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
      page: req.query.page,
      pageSize: req.query.pageSize,
    })
    return ok(res, data)
  } catch (error) {
    next(error)
  }
}

export const getAdminOrderByIdHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertAdmin(req, res)) return
    const orderId = parseOrderId(req, res)
    if (orderId == null) return

    const order = await getAdminOrderById(orderId)
    if (!order) {
      return fail(res, 404, 'Order not found', 'NOT_FOUND')
    }
    return ok(res, order)
  } catch (error) {
    next(error)
  }
}

export const patchAdminOrderHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const managerTelegramId = assertAdmin(req, res)
    if (managerTelegramId == null) return

    const orderId = parseOrderId(req, res)
    if (orderId == null) return

    const parsed = patchBodySchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }

    if (
      parsed.data.status === undefined &&
      parsed.data.adminComment === undefined &&
      parsed.data.deliveryEta === undefined
    ) {
      return fail(res, 400, 'No fields to update', 'VALIDATION')
    }

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
      return fail(res, 404, 'Order not found', 'NOT_FOUND')
    }

    const newStatus = parsed.data.status ?? result.order.status
    if (shouldNotifyConfirmed(result.previousStatus, newStatus)) {
      void notifyClientStatusChange(adminOrderDetailToOrderDraft(result.order), newStatus).catch(
        (err) => {
          console.error('[notify-client-status:error]', err)
        },
      )
    }

    return ok(res, result.order)
  } catch (error) {
    next(error)
  }
}

export const refreshCdekTrackHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertAdmin(req, res)) return
    const orderId = parseOrderId(req, res)
    if (orderId == null) return

    const { pool } = await import('../utils/db')
    const order = await pool.query<{ cdek_uuid: string | null; cdek_track_number: string | null }>(
      `SELECT cdek_uuid, cdek_track_number FROM orders WHERE id = $1`,
      [orderId],
    )
    const uuid = order.rows[0]?.cdek_uuid
    if (!uuid) {
      return fail(res, 400, 'No cdek_uuid for this order', 'VALIDATION')
    }

    const { pollTrackNumberNow } = await import('../services/cdek/track-poll.service')
    const got = await pollTrackNumberNow(orderId, uuid)
    const refreshed = await pool.query<{ cdek_track_number: string | null }>(
      `SELECT cdek_track_number FROM orders WHERE id = $1`,
      [orderId],
    )
    return ok(res, {
      scheduled: !got,
      trackNumber: refreshed.rows[0]?.cdek_track_number ?? null,
    })
  } catch (error) {
    next(error)
  }
}

export const retryCdekOrderHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertAdmin(req, res)) return
    const orderId = parseOrderId(req, res)
    if (orderId == null) return

    const { pool } = await import('../utils/db')
    await pool.query(
      `UPDATE orders SET cdek_sync_state = 'pending', cdek_create_error = NULL WHERE id = $1`,
      [orderId],
    )

    const { createCdekOrder } = await import('../services/cdek/orders.service')
    const result = await createCdekOrder(orderId)
    return ok(res, { uuid: result?.uuid ?? null })
  } catch (error) {
    next(error)
  }
}

export const restockAdminOrderHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertAdmin(req, res)) return
    const orderId = parseOrderId(req, res)
    if (orderId == null) return

    const order = await restockAdminOrder(orderId)
    return ok(res, order)
  } catch (error) {
    const statusCode =
      error instanceof Error && (error as Error & { statusCode?: number }).statusCode === 409
        ? 409
        : undefined
    if (statusCode === 409) {
      return fail(
        res,
        409,
        error instanceof Error ? error.message : 'Conflict',
        'CONFLICT',
      )
    }
    next(error)
  }
}
