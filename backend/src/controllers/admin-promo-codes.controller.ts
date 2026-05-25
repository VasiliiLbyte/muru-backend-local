import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import {
  createPromoCode,
  deletePromoCode,
  listPromoCodeUsages,
  listPromoCodes,
  updatePromoCode,
} from '../services/admin-promo-codes.service'
import { env } from '../utils/env'
import { fail, HttpError, ok, zodErrorMessage } from '../utils/api-response'

const parseTelegramUserId = (req: Request): number | null => {
  const headerId = req.header('x-telegram-user-id')
  const bodyId = req.body?.telegramUserId
  const raw = headerId ?? bodyId
  const parsed = Number(raw)
  return Number.isInteger(parsed) ? parsed : null
}

const assertAdmin = (req: Request, res: Response): boolean => {
  const telegramUserId = parseTelegramUserId(req)
  if (!telegramUserId || !env.adminTelegramIds.includes(telegramUserId)) {
    fail(res, 403, 'Forbidden: admin access required', 'FORBIDDEN')
    return false
  }
  return true
}

const optionalDate = z.union([z.string(), z.null()]).optional()

const createPromoSchema = z.object({
  code: z.string().min(1),
  discountType: z.enum(['percent', 'fixed']),
  discountValue: z.number().positive(),
  minOrderAmount: z.number().nonnegative().optional(),
  startsAt: optionalDate,
  expiresAt: optionalDate,
  usageLimit: z.number().int().positive().nullable().optional(),
  usageLimitPerUser: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
})

const patchPromoSchema = createPromoSchema.partial()

const routeParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

const parseId = (raw: string | string[] | undefined): number | null => {
  const id = Number(routeParam(raw))
  return Number.isInteger(id) && id > 0 ? id : null
}

const emptyToNull = (value: string | null | undefined): string | null => {
  if (value == null || value === '') return null
  return value
}

export const listAdminPromoCodesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertAdmin(req, res)) return
    const items = await listPromoCodes()
    return ok(res, items)
  } catch (error) {
    next(error)
  }
}

export const createAdminPromoCodeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertAdmin(req, res)) return
    const parsed = createPromoSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }

    const created = await createPromoCode({
      ...parsed.data,
      startsAt: emptyToNull(parsed.data.startsAt as string | null | undefined),
      expiresAt: emptyToNull(parsed.data.expiresAt as string | null | undefined),
    })
    return ok(res, created, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create promo code'
    if (message.includes('unique') || message.includes('duplicate')) {
      return fail(res, 409, message, 'CONFLICT')
    }
    next(error)
  }
}

export const patchAdminPromoCodeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertAdmin(req, res)) return
    const id = parseId(req.params.id)
    if (!id) return fail(res, 400, 'Invalid promo id', 'VALIDATION')

    const parsed = patchPromoSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, zodErrorMessage(parsed.error.issues), 'VALIDATION', parsed.error.issues)
    }

    const patch = {
      ...parsed.data,
      startsAt:
        parsed.data.startsAt !== undefined
          ? emptyToNull(parsed.data.startsAt as string | null | undefined)
          : undefined,
      expiresAt:
        parsed.data.expiresAt !== undefined
          ? emptyToNull(parsed.data.expiresAt as string | null | undefined)
          : undefined,
    }
    const updated = await updatePromoCode(id, patch)
    if (!updated) {
      return fail(res, 404, 'Promo code not found', 'NOT_FOUND')
    }
    return ok(res, updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update promo code'
    if (message.includes('unique') || message.includes('duplicate')) {
      return fail(res, 409, message, 'CONFLICT')
    }
    next(error)
  }
}

export const deleteAdminPromoCodeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertAdmin(req, res)) return
    const id = parseId(req.params.id)
    if (!id) return fail(res, 400, 'Invalid promo id', 'VALIDATION')

    const deleted = await deletePromoCode(id)
    if (!deleted) {
      return fail(res, 404, 'Promo code not found', 'NOT_FOUND')
    }
    return ok(res, { deleted: true })
  } catch (error) {
    next(error)
  }
}

export const listAdminPromoCodeUsagesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!assertAdmin(req, res)) return
    const id = parseId(req.params.id)
    if (!id) return fail(res, 400, 'Invalid promo id', 'VALIDATION')

    const usages = await listPromoCodeUsages(id)
    return ok(res, usages)
  } catch (error) {
    next(error)
  }
}
