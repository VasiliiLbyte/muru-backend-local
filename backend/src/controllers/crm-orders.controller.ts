import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import { isValidOrderStatus } from '../constants/order-statuses'
import type { CrmRequest } from '../middleware/require-crm-auth.middleware'
import { shouldNotifyAssembling } from '../services/admin-orders.helpers'
import {
  cancelCrmOrder,
  crmOrderDetailToOrderDraft,
  getCrmOrderById,
  listCrmOrders,
  updateCrmOrder,
} from '../services/crm-orders.service'
import { notifyClientStatusChange } from '../services/order-notifications.service'
import type { StockActor } from '../services/stock-movements.service'
import type { OrderChannel } from '../types/order'
import { fail, HttpError, ok, zodErrorMessage } from '../utils/api-response'
import { pool } from '../utils/db'

const parseOrderId = (req: Request, res: Response): number | null => {
  const parsed = Number(req.params.id)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(res, 400, 'Некорректный номер заказа.', 'VALIDATION')
    return null
  }
  return parsed
}

const parseChannel = (value: unknown): OrderChannel | undefined => {
  if (value === 'telegram' || value === 'web') return value
  return undefined
}

const patchBodySchema = z
  .object({
    status: z.string().min(1).optional(),
    adminComment: z.string().optional(),
    deliveryEta: z.string().nullable().optional(),
  })
  .strict()

const resolveCrmOrderActor = async (req: Request): Promise<StockActor> => {
  const adminId = (req as CrmRequest).crmAdmin?.adminId
  if (adminId == null) return { type: 'system' }
  const r = await pool.query<{ email: string }>(`SELECT email FROM admin_users WHERE id = $1`, [
    adminId,
  ])
  return {
    type: 'admin',
    adminId,
    label: r.rows[0]?.email ?? `admin:${adminId}`,
  }
}
export const listCrmOrdersHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await listCrmOrders({
      channel: parseChannel(req.query.channel),
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

export const getCrmOrderByIdHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderId = parseOrderId(req, res)
    if (orderId == null) return

    const order = await getCrmOrderById(orderId)
    if (!order) {
      return fail(res, 404, 'Заказ не найден.', 'NOT_FOUND')
    }
    return ok(res, order)
  } catch (error) {
    next(error)
  }
}

export const patchCrmOrderHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
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
      return fail(res, 400, 'Нет полей для сохранения.', 'VALIDATION')
    }

    if (parsed.data.status !== undefined && !isValidOrderStatus(parsed.data.status)) {
      return fail(res, 400, `Некорректный статус заказа: ${parsed.data.status}`, 'VALIDATION')
    }

    const result = await updateCrmOrder(orderId, {
      status: parsed.data.status,
      adminComment: parsed.data.adminComment,
      deliveryEta: parsed.data.deliveryEta,
      actor: await resolveCrmOrderActor(req),
    })

    if (!result) {
      return fail(res, 404, 'Заказ не найден.', 'NOT_FOUND')
    }

    const newStatus = parsed.data.status ?? result.order.status
    if (
      result.order.channel === 'telegram' &&
      result.order.telegramUserId != null &&
      shouldNotifyAssembling(result.previousStatus, newStatus)
    ) {
      void notifyClientStatusChange(crmOrderDetailToOrderDraft(result.order), newStatus).catch(
        (err) => {
          console.error('[notify-client-status:error]', err)
        },
      )
    }

    return ok(res, result.order)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Некорректный статус заказа')) {
      return fail(res, 400, error.message, 'VALIDATION')
    }
    next(error)
  }
}

export const cancelCrmOrderHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderId = parseOrderId(req, res)
    if (orderId == null) return

    const order = await cancelCrmOrder(orderId)
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
        error instanceof Error ? error.message : 'Конфликт данных.',
        'CONFLICT',
      )
    }
    next(error)
  }
}
