import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import type { AuthenticatedRequest } from '../middleware/auth.middleware'
import { createInvoiceForCheckout } from '../services/telegram/invoice.service'
import {
  createPayment,
  getPaymentIntentStatusForUser,
  getPaymentStatusForUser,
  type RawCheckoutInput,
} from '../services/yookassa/payments.service'
import { env } from '../utils/env'
import { fail, ok } from '../utils/api-response'

export const snapshotSchema = z
  .object({
    items: z
      .array(
        z.object({
          sku: z.string().min(1),
          quantity: z.number().int().positive(),
          color: z.string().optional(),
          size: z.string().optional(),
        }),
      )
      .min(1),
    promoCode: z.string().nullable().default(null),
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
  .strict()

export const parseCheckoutBody = (
  req: Request,
  res: Response,
): RawCheckoutInput | null => {
  const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
  if (!telegramUserId) {
    fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    return null
  }

  const parsed = snapshotSchema.safeParse(req.body)
  if (!parsed.success) {
    fail(res, 400, 'Некорректные данные заказа', 'VALIDATION', parsed.error.issues)
    return null
  }

  if (parsed.data.deliveryMode === 'delivery' && !parsed.data.address.trim()) {
    fail(res, 400, 'Address is required for delivery', 'VALIDATION')
    return null
  }

  return {
    ...parsed.data,
    telegramUserId,
  }
}

export const createPaymentHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!env.yookassa.enabled) {
      return fail(res, 503, 'Оплата временно недоступна', 'UPSTREAM')
    }

    const raw = parseCheckoutBody(req, res)
    if (!raw) return

    const result = await createPayment(raw)
    return ok(res, result)
  } catch (e) {
    next(e)
  }
}

export const createInvoiceHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!env.payments.nativeEnabled) {
      return fail(res, 503, 'Оплата через Telegram недоступна', 'UPSTREAM')
    }

    const raw = parseCheckoutBody(req, res)
    if (!raw) return

    const result = await createInvoiceForCheckout(raw)
    return ok(res, result)
  } catch (e) {
    next(e)
  }
}

export const getPaymentIntentStatusHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
    if (!telegramUserId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')

    const intentId = Number.parseInt(String(req.params.intentId), 10)
    if (!Number.isInteger(intentId) || intentId <= 0) {
      return fail(res, 400, 'Invalid intent id', 'VALIDATION')
    }

    const status = await getPaymentIntentStatusForUser(intentId, telegramUserId)
    if (!status) return fail(res, 404, 'Платёж не найден', 'NOT_FOUND')
    return ok(res, status)
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
