import type { PoolClient } from 'pg'

import { isTerminalOrderStatus } from '../constants/order-statuses'

export type StockActor =
  | { type: 'system' }
  | { type: 'admin'; adminId?: number | null; label?: string | null }

export type StockMovementType = 'sale' | 'return' | 'adjustment'

export type ApplyStockDeltaInput = {
  productSku: string
  delta: number
  type: StockMovementType
  reason: string
  orderId?: number | null
  actor: StockActor
}

export class StockProductNotFoundError extends Error {
  constructor(sku: string) {
    super(`Товар со SKU ${sku} не найден для изменения остатка.`)
    this.name = 'StockProductNotFoundError'
  }
}

export const applyStockDelta = async (
  client: PoolClient,
  input: ApplyStockDeltaInput,
): Promise<{ before: number; after: number }> => {
  const productRes = await client.query<{ id: number; name: string; in_stock: number }>(
    `SELECT id, name, in_stock FROM products WHERE sku = $1 FOR UPDATE`,
    [input.productSku],
  )
  const product = productRes.rows[0]
  if (!product) {
    throw new StockProductNotFoundError(input.productSku)
  }

  const before = Number(product.in_stock)
  const after = input.delta < 0 ? Math.max(0, before + input.delta) : before + input.delta
  const actualDelta = after - before

  await client.query(`UPDATE products SET in_stock = $1, updated_at = NOW() WHERE id = $2`, [
    after,
    product.id,
  ])

  const actorType = input.actor.type
  const actorAdminId = input.actor.type === 'admin' ? (input.actor.adminId ?? null) : null
  const actorLabel = input.actor.type === 'admin' ? (input.actor.label ?? null) : null

  await client.query(
    `INSERT INTO stock_movements (
       product_id, product_sku, product_name, delta, type, reason, order_id,
       stock_before, stock_after, actor_type, actor_admin_id, actor_label
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      product.id,
      input.productSku,
      product.name,
      actualDelta,
      input.type,
      input.reason,
      input.orderId ?? null,
      before,
      after,
      actorType,
      actorAdminId,
      actorLabel,
    ],
  )

  return { before, after }
}

export const settleOrderStockOnStatusChange = async (
  client: PoolClient,
  input: {
    orderId: number
    previousStatus: string
    newStatus: string
    actor: StockActor
  },
): Promise<void> => {
  if (!isTerminalOrderStatus(input.newStatus) || isTerminalOrderStatus(input.previousStatus)) {
    return
  }

  const existingReturn = await client.query<{ exists: number }>(
    `SELECT 1 AS exists FROM stock_movements WHERE order_id = $1 AND type = 'return' LIMIT 1`,
    [input.orderId],
  )
  if (existingReturn.rows.length > 0) {
    return
  }

  const itemsRes = await client.query<{ product_sku: string; quantity: number }>(
    `SELECT product_sku, quantity FROM order_items WHERE order_id = $1`,
    [input.orderId],
  )

  for (const item of itemsRes.rows) {
    await applyStockDelta(client, {
      productSku: item.product_sku,
      delta: item.quantity,
      type: 'return',
      reason: `Возврат по заказу #${input.orderId}`,
      orderId: input.orderId,
      actor: input.actor,
    })
  }
}
