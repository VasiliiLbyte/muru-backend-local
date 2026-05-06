import type { Request, Response } from 'express'
import { z } from 'zod'

import { createOrder, getDraftOrderByTelegramUserId, saveDraftOrder } from '../services/orders.service'

const itemSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  color: z.string().optional(),
  size: z.string().optional(),
})

const draftPayloadSchema = z.object({
  telegramUserId: z.number().int().positive(),
  items: z.array(itemSchema),
  deliveryMode: z.enum(['delivery', 'pickup']),
  deliveryOption: z.string().optional(),
  deliveryPrice: z.number().nonnegative().optional(),
  deliveryEta: z.string().optional(),
  address: z.string().optional(),
  comment: z.string().optional(),
  birthDate: z.string().optional(),
})

export const getDraftOrderHandler = async (req: Request, res: Response) => {
  const telegramUserId = Number(req.params.telegramUserId)
  if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
    return res.status(400).json({ success: false, data: null, error: 'Invalid telegramUserId' })
  }

  try {
    const draft = await getDraftOrderByTelegramUserId(telegramUserId)
    return res.json({ success: true, data: draft, error: null })
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load draft',
    })
  }
}

export const saveDraftOrderHandler = async (req: Request, res: Response) => {
  const parsed = draftPayloadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      data: null,
      error: parsed.error.issues.map((issue) => issue.message).join('; '),
    })
  }
  if (parsed.data.deliveryMode === 'delivery' && !parsed.data.address?.trim()) {
    return res.status(400).json({ success: false, data: null, error: 'Address is required for delivery' })
  }

  try {
    const draft = await saveDraftOrder(parsed.data)
    return res.json({ success: true, data: draft, error: null })
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to save draft',
    })
  }
}

export const createOrderHandler = async (req: Request, res: Response) => {
  const parsed = draftPayloadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      data: null,
      error: parsed.error.issues.map((issue) => issue.message).join('; '),
    })
  }
  if (parsed.data.items.length === 0) {
    return res.status(400).json({ success: false, data: null, error: 'Order items are required' })
  }
  if (parsed.data.deliveryMode === 'delivery' && !parsed.data.address?.trim()) {
    return res.status(400).json({ success: false, data: null, error: 'Address is required for delivery' })
  }

  try {
    const order = await createOrder(parsed.data)
    console.log('[order-notify]', {
      orderId: order.id,
      telegramUserId: order.telegramUserId,
      total: order.total,
      deliveryMode: order.deliveryMode,
      deliveryOption: order.deliveryOption,
      status: order.status,
    })
    return res.json({ success: true, data: order, error: null })
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to create order',
    })
  }
}
