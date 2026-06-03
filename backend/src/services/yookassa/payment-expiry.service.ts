import { randomUUID } from 'node:crypto'

import { pool } from '../../utils/db'

import { ykFetch } from './client'

const log = console

/** Cancels pending payments older than 24h (DB + YooKassa when possible). */
export const cancelStalePayments = async (): Promise<void> => {
  const stale = await pool.query<{ yookassa_payment_id: string | null; id: number }>(
    `SELECT id, yookassa_payment_id FROM payments
     WHERE status IN ('pending','waiting_for_capture')
       AND created_at < NOW() - INTERVAL '24 hours'
     LIMIT 100`,
  )
  for (const row of stale.rows) {
    try {
      if (row.yookassa_payment_id) {
        await ykFetch({
          method: 'POST',
          path: `/payments/${row.yookassa_payment_id}/cancel`,
          idempotenceKey: randomUUID(),
        }).catch(() => undefined)
      }
      await pool.query(`UPDATE payments SET status='canceled', updated_at=NOW() WHERE id=$1`, [row.id])
    } catch (e) {
      log.warn?.('[yk-expiry] cancel failed', { id: row.id, e })
    }
  }
}
