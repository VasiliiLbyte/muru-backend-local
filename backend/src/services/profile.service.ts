import { pool } from '../utils/db'
import type { UserProfile } from '../types/profile'

export const getProfileByTelegramUserId = async (telegramUserId: number): Promise<UserProfile> => {
  const result = await pool.query<{
    telegram_user_id: string
    full_name: string
    phone: string
    delivery_addresses: string[] | null
  }>(
    `SELECT telegram_user_id, full_name, phone, delivery_addresses
     FROM user_profiles
     WHERE telegram_user_id = $1
     LIMIT 1`,
    [telegramUserId],
  )

  const row = result.rows[0]
  if (!row) {
    return {
      telegramUserId,
      fullName: '',
      phone: '',
      deliveryAddresses: [],
    }
  }

  return {
    telegramUserId: Number(row.telegram_user_id),
    fullName: row.full_name,
    phone: row.phone,
    deliveryAddresses: Array.isArray(row.delivery_addresses) ? row.delivery_addresses : [],
  }
}

export const upsertProfileByTelegramUserId = async (input: UserProfile): Promise<UserProfile> => {
  const result = await pool.query<{
    telegram_user_id: string
    full_name: string
    phone: string
    delivery_addresses: string[] | null
  }>(
    `INSERT INTO user_profiles (telegram_user_id, full_name, phone, delivery_addresses, created_at, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW())
     ON CONFLICT (telegram_user_id)
     DO UPDATE SET
       full_name = EXCLUDED.full_name,
       phone = EXCLUDED.phone,
       delivery_addresses = EXCLUDED.delivery_addresses,
       updated_at = NOW()
     RETURNING telegram_user_id, full_name, phone, delivery_addresses`,
    [input.telegramUserId, input.fullName, input.phone, JSON.stringify(input.deliveryAddresses)],
  )

  const row = result.rows[0]
  return {
    telegramUserId: Number(row.telegram_user_id),
    fullName: row.full_name,
    phone: row.phone,
    deliveryAddresses: Array.isArray(row.delivery_addresses) ? row.delivery_addresses : [],
  }
}

