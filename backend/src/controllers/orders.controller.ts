import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import type { AuthenticatedRequest } from '../middleware/auth.middleware'
import { validatePromoCode } from '../services/promo.service'
import { getDraftOrderByTelegramUserId, getOrdersByTelegramUserId, saveDraftOrder } from '../services/orders.service'
import { fail, HttpError, ok, zodErrorMessage } from '../utils/api-response'

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
  promoCode: z.string().optional(),
  cdekTariffCode: z.number().int().positive().optional(),
  cdekCityCode: z.number().int().positive().optional(),
  cdekCityName: z.string().optional(),
  cdekPvzCode: z.string().nullable().optional(),
  cdekPvzAddress: z.string().nullable().optional(),
  recipientName: z.string().trim().min(2).max(100).optional(),
  recipientPhone: z.string().trim().min(10).max(20).optional(),
  consentAccepted: z.boolean().optional(),
  consentVersion: z.string().max(32).optional(),
})

const validatePromoBodySchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().nonnegative(),
})

export const getDraftOrderHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
    if (!telegramUserId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')

    const draft = await getDraftOrderByTelegramUserId(telegramUserId)
    return ok(res, draft)
  } catch (error) {
    next(error)
  }
}

export const saveDraftOrderHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
    if (!telegramUserId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')

    const parsed = draftPayloadSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }
    if (parsed.data.deliveryMode === 'delivery' && !parsed.data.address?.trim()) {
      return fail(res, 400, 'Address is required for delivery', 'VALIDATION')
    }

    const draft = await saveDraftOrder({ ...parsed.data, telegramUserId })
    return ok(res, draft)
  } catch (error) {
    next(error)
  }
}

export const validatePromoHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
    if (!telegramUserId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')

    const parsed = validatePromoBodySchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }

    const result = await validatePromoCode({
      code: parsed.data.code,
      telegramUserId,
      subtotal: parsed.data.subtotal,
    })
    if (!result.valid) {
      return ok(res, { valid: false, reason: result.reason })
    }
    return ok(res, {
      valid: true,
      discountValue: result.discountValue,
      discountType: result.discountType,
      code: result.code,
    })
  } catch (error) {
    next(error)
  }
}

export const getMyOrdersHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const telegramUserId = (req as AuthenticatedRequest).auth?.telegramId
    if (!telegramUserId) return fail(res, 401, 'Unauthorized', 'UNAUTHORIZED')

    const orders = await getOrdersByTelegramUserId(telegramUserId)
    return ok(res, orders)
  } catch (error) {
    next(error)
  }
}
