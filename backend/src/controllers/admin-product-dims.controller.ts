import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import {
  listProductDims,
  resetProductDimsToAuto,
  updateProductDims,
  validateProductDimsUpdate,
  type ProductDimsFilter,
} from '../services/admin-product-dims.service'
import { env } from '../utils/env'
import { fail, ok, zodErrorMessage } from '../utils/api-response'

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

const routeParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

const filterSchema = z.enum(['all', 'default', 'manual'])

const patchDimsSchema = z.union([
  z.object({ resetToAuto: z.literal(true) }),
  z.object({
    weightGrams: z.number(),
    lengthCm: z.number(),
    widthCm: z.number(),
    heightCm: z.number(),
  }),
])

export const listAdminProductDimsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!assertAdmin(req, res)) return
    const q = String(req.query.q ?? '').trim()
    const filterRaw = String(req.query.filter ?? 'all')
    const filterParsed = filterSchema.safeParse(filterRaw)
    const filter: ProductDimsFilter = filterParsed.success ? filterParsed.data : 'all'
    const rows = await listProductDims(q, filter)
    return ok(res, rows)
  } catch (error) {
    next(error)
  }
}

export const patchAdminProductDimsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!assertAdmin(req, res)) return
    const sku = routeParam(req.params.sku)?.trim()
    if (!sku) {
      return fail(res, 400, 'SKU is required', 'VALIDATION')
    }

    const parsed = patchDimsSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return fail(res, 400, zodErrorMessage(parsed.error), 'VALIDATION')
    }

    if ('resetToAuto' in parsed.data) {
      const reset = await resetProductDimsToAuto(sku)
      if (!reset) {
        return fail(res, 404, 'Product not found', 'NOT_FOUND')
      }
      return ok(res, { sku, reset: true })
    }

    const input = {
      weightGrams: Math.round(parsed.data.weightGrams),
      lengthCm: Math.round(parsed.data.lengthCm),
      widthCm: Math.round(parsed.data.widthCm),
      heightCm: Math.round(parsed.data.heightCm),
    }
    const validation = validateProductDimsUpdate(input)
    if (!validation.ok) {
      return fail(res, 400, validation.message, 'VALIDATION')
    }

    const updated = await updateProductDims(sku, input)
    if (!updated) {
      return fail(res, 404, 'Product not found', 'NOT_FOUND')
    }
    return ok(res, updated)
  } catch (error) {
    next(error)
  }
}
