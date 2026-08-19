import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import type { AuthenticatedRequest } from '../middleware/auth.middleware'
import { createInvoiceForCheckout } from '../services/telegram/invoice.service'
import { verifyCustomerAccessJwt } from '../services/customer-auth.service'
import { normalizeRussianPhone } from '../services/cdek/phone'
import { validatePromoCode } from '../services/promo.service'
import {
  createPayment,
  getPaymentIntentStatusForUser,
  getPaymentStatusForUser,
  getWebPaymentStatus,
  type RawCheckoutInput,
} from '../services/yookassa/payments.service'
import { env } from '../utils/env'
import { fail, ok } from '../utils/api-response'

const recipientPhoneSchema = z.string().transform((raw, ctx) => {
  const normalized = normalizeRussianPhone(raw)
  if (!normalized) {
    ctx.addIssue({ code: 'custom', message: 'Некорректный телефон' })
    return z.NEVER
  }
  return normalized
})

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
    email: z.string().trim().email('Некорректный e-mail').nullable().default(null),
    deliveryMode: z.enum(['delivery', 'pickup']),
    deliveryOption: z.string().nullable().default(null),
    deliveryEta: z.string().nullable().default(null),
    address: z.string(),
    comment: z.string().default(''),
    birthDate: z.string().nullable().default(null),
    recipientName: z.string().min(2),
    recipientPhone: recipientPhoneSchema,
    cdekTariffCode: z.number().int().nullable().default(null),
    cdekCityCode: z.number().int().nullable().default(null),
    cdekCityName: z.string().nullable().default(null),
    cdekPvzCode: z.string().nullable().default(null),
    cdekPvzAddress: z.string().nullable().default(null),
  })
  .strict()

const webSnapshotSchema = snapshotSchema
  .extend({ email: z.string().trim().email('Некорректный e-mail') })
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
    channel: 'telegram',
    customerId: null,
  }
}

export const parseWebCheckoutBody = (
  req: Request,
  res: Response,
): RawCheckoutInput | null => {
  const parsed = webSnapshotSchema.safeParse(req.body)
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
    telegramUserId: null,
    channel: 'web',
    promoCode: parsed.data.promoCode || null,
    customerId: null,
  }
}

const optionalCustomerIdFromRequest = (req: Request): number | null => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) return null
  const payload = verifyCustomerAccessJwt(token)
  return payload?.customerId ?? null
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

export const createWebPaymentHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!env.yookassa.enabled) {
      return fail(res, 503, 'Оплата временно недоступна', 'UPSTREAM')
    }

    const raw = parseWebCheckoutBody(req, res)
    if (!raw) return

    raw.customerId = optionalCustomerIdFromRequest(req)

    const result = await createPayment(raw)
    return ok(res, result)
  } catch (e) {
    next(e)
  }
}

export const validateWebPromoHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      code: z.string().min(1),
      subtotal: z.number().positive(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, 'Некорректные данные', 'VALIDATION', parsed.error.issues)
    }

    const customerId = optionalCustomerIdFromRequest(req)
    const result = await validatePromoCode({
      code: parsed.data.code,
      subtotal: parsed.data.subtotal,
      customerId,
    })
    return ok(res, result)
  } catch (error) {
    next(error)
  }
}

export const getWebPaymentStatusHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const paymentId = String(req.params.paymentId)
    const status = await getWebPaymentStatus(paymentId)
    if (!status) return fail(res, 404, 'Платёж не найден', 'NOT_FOUND')
    return ok(res, status)
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
