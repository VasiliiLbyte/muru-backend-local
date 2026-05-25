import type { Request, Response } from 'express'
import { z } from 'zod'

import {
  createPromoCode,
  deletePromoCode,
  listPromoCodeUsages,
  listPromoCodes,
  updatePromoCode,
} from '../services/admin-promo-codes.service'
import { env } from '../utils/env'

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
    res.status(403).json({
      success: false,
      data: null,
      error: 'Forbidden: admin access required',
    })
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

const parseId = (raw: string | undefined): number | null => {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

const emptyToNull = (value: string | null | undefined): string | null => {
  if (value == null || value === '') return null
  return value
}

export const listAdminPromoCodesHandler = async (req: Request, res: Response) => {
  if (!assertAdmin(req, res)) return
  try {
    const items = await listPromoCodes()
    res.json({ success: true, data: items, error: null })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to list promo codes',
    })
  }
}

export const createAdminPromoCodeHandler = async (req: Request, res: Response) => {
  if (!assertAdmin(req, res)) return
  const parsed = createPromoSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      data: null,
      error: parsed.error.issues.map((issue) => issue.message).join('; '),
    })
  }
  try {
    const created = await createPromoCode({
      ...parsed.data,
      startsAt: emptyToNull(parsed.data.startsAt as string | null | undefined),
      expiresAt: emptyToNull(parsed.data.expiresAt as string | null | undefined),
    })
    res.status(201).json({ success: true, data: created, error: null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create promo code'
    const status = message.includes('unique') || message.includes('duplicate') ? 409 : 500
    res.status(status).json({ success: false, data: null, error: message })
  }
}

export const patchAdminPromoCodeHandler = async (req: Request, res: Response) => {
  if (!assertAdmin(req, res)) return
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ success: false, data: null, error: 'Invalid promo id' })

  const parsed = patchPromoSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      data: null,
      error: parsed.error.issues.map((issue) => issue.message).join('; '),
    })
  }

  try {
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
      return res.status(404).json({ success: false, data: null, error: 'Promo code not found' })
    }
    res.json({ success: true, data: updated, error: null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update promo code'
    const status = message.includes('unique') || message.includes('duplicate') ? 409 : 500
    res.status(status).json({ success: false, data: null, error: message })
  }
}

export const deleteAdminPromoCodeHandler = async (req: Request, res: Response) => {
  if (!assertAdmin(req, res)) return
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ success: false, data: null, error: 'Invalid promo id' })

  try {
    const deleted = await deletePromoCode(id)
    if (!deleted) {
      return res.status(404).json({ success: false, data: null, error: 'Promo code not found' })
    }
    res.json({ success: true, data: { deleted: true }, error: null })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to delete promo code',
    })
  }
}

export const listAdminPromoCodeUsagesHandler = async (req: Request, res: Response) => {
  if (!assertAdmin(req, res)) return
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ success: false, data: null, error: 'Invalid promo id' })

  try {
    const usages = await listPromoCodeUsages(id)
    res.json({ success: true, data: usages, error: null })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load promo usages',
    })
  }
}
