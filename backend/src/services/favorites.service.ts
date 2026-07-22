import { pool } from '../utils/db'
import type { FavoriteItem, FavoritePayload } from '../types/favorite'

export const getFavoritesByTelegramUserId = async (telegramUserId: number): Promise<FavoriteItem[]> => {
  const result = await pool.query<{
    sku: string
    name: string
    price: string
    image_url_1: string
    in_stock: number
  }>(
    `SELECT p.sku, p.name, p.price::text, p.image_url_1, p.in_stock
     FROM favorites f
     JOIN products p ON p.sku = f.product_sku
     WHERE f.telegram_user_id = $1
     ORDER BY f.created_at DESC`,
    [telegramUserId],
  )

  return result.rows.map((row) => ({
    sku: row.sku,
    name: row.name,
    price: Number(row.price),
    imageUrl: row.image_url_1,
    inStock: row.in_stock,
  }))
}

export const addFavorite = async (payload: FavoritePayload): Promise<void> => {
  await pool.query(
    `INSERT INTO favorites (telegram_user_id, product_sku, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (telegram_user_id, product_sku) WHERE (telegram_user_id IS NOT NULL) DO NOTHING`,
    [payload.telegramUserId, payload.sku],
  )
}

export const removeFavorite = async (payload: FavoritePayload): Promise<void> => {
  await pool.query(`DELETE FROM favorites WHERE telegram_user_id = $1 AND product_sku = $2`, [
    payload.telegramUserId,
    payload.sku,
  ])
}

