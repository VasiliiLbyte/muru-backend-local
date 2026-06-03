import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import type { AuthenticatedRequest } from '../middleware/auth.middleware'
import {
  createPayment,
  getPaymentStatusForUser,
  type CheckoutSnapshot,
} from '../services/yookassa/payments.service'
import { env } from '../utils/env'
import { fail, ok } from '../utils/api-response'

const snapshotSchema = z.object({
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        name: z.string().min(1),
        price: z.number().nonnegative(),
        quantity: z.number().int().positive(),
        color: z.string().optional(),
        size: z.string().optional(),
      }),
    )
    .min(1),
  subtotal: z.number().nonnegative(),
  deliveryPrice: z.number().nonnegative(),
  promoCode: z.string().nullable().default(null),
  promoDiscount: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  deliveryMode: z.enum(['delivery', 'pickup']),
  deliveryOption: z.string().nullable().default(null),
  deliveryEta: z.string().nullable().default(null),
  address: z.string(),
  comment: z.string().default(''),
  birthDate: z.string().nullable().default(null),
  recipientName: z.string().min(2),
  recipientPhone: z.string().min(10),
  cdekTariffCode: z.number().int().nullable().default(null),
  cdekCityCode: z.number().int().nullable().default(null),
  cdekCityName: z.string().nullable().default(null),
  cdekPvzCode: z.string().nullable().default(null),
  cdekPvzAddress: z.string().nullable().default(null),
})

export const createPaymentHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!env.yookassa.enabled) {
      return fail(res, 503, 'Оплата временно недоступна', 'UPSTREAM')
    }

    const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
    if (!telegramUserId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')

    const parsed = snapshotSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, 'Некорректные данные заказа', 'VALIDATION', parsed.error.issues)
    }

    if (parsed.data.deliveryMode === 'delivery' && !parsed.data.address.trim()) {
      return fail(res, 400, 'Address is required for delivery', 'VALIDATION')
    }

    const snapshot: CheckoutSnapshot = {
      ...parsed.data,
      telegramUserId,
    }

    const result = await createPayment(snapshot)
    return ok(res, result)
  } catch (e) {
    next(e)
  }
}

export const getPaymentStatusHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
    if (!telegramUserId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')

    const paymentId = String(req.params.paymentId)
    const status = await getPaymentStatusForUser(paymentId, telegramUserId)
    if (!status) return fail(res, 404, 'Платёж не найден', 'NOT_FOUND')
    return ok(res, status)
  } catch (e) {
    next(e)
  }
}
