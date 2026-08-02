import {
  isTerminalOrderStatus,
  ORDER_STATUS_RETURNED,
} from '../../constants/order-statuses'
import { pool } from '../../utils/db'
import {
  notifyAdminsRefundFull,
  notifyAdminsRefundPartial,
} from '../order-notifications.service'
import { settleOrderStockOnStatusChange } from '../stock-movements.service'

const log = console

const toKop = (value: string | number): number => Math.round(Number(value) * 100)

export type HandleRefundSucceededInput = {
  paymentId: string
  refundAmount: string
  refundId?: string
}

/**
 * Process YooKassa refund.succeeded. Full refund → status Возврат + stock settle + TG.
 * Partial → TG only. Idempotent for repeat webhooks / already-terminal orders.
 * Never throws (caller already ACKed 200).
 */
export const handleRefundSucceeded = async (input: HandleRefundSucceededInput): Promise<void> => {
  try {
    const paymentRes = await pool.query<{ id: number; order_id: number | null }>(
      `SELECT id, order_id FROM payments WHERE yookassa_payment_id = $1`,
      [input.paymentId],
    )
    const payment = paymentRes.rows[0]
    if (!payment) {
      log.warn?.('[yk-refund] payment not found', {
        paymentId: input.paymentId,
        refundId: input.refundId,
      })
      return
    }
    if (payment.order_id == null) {
      log.warn?.('[yk-refund] payment has no order_id', {
        paymentId: input.paymentId,
        paymentRowId: payment.id,
        refundId: input.refundId,
      })
      return
    }

    const orderId = payment.order_id
    const orderRes = await pool.query<{ id: number; status: string; total: string }>(
      `SELECT id, status, total::text FROM orders WHERE id = $1`,
      [orderId],
    )
    const order = orderRes.rows[0]
    if (!order) {
      log.warn?.('[yk-refund] order not found', { orderId, paymentId: input.paymentId })
      return
    }

    const refundKop = toKop(input.refundAmount)
    const orderTotalKop = toKop(order.total)
    const orderTotal = Number(order.total)
    const refundAmountNum = Number(input.refundAmount)

    if (!Number.isFinite(refundKop) || !Number.isFinite(orderTotalKop)) {
      log.warn?.('[yk-refund] invalid amounts', {
        orderId,
        refundAmount: input.refundAmount,
        orderTotal: order.total,
      })
      return
    }

    const isFull = refundKop === orderTotalKop

    if (!isFull) {
      log.log?.('[yk-refund] partial refund', {
        orderId,
        refundId: input.refundId,
        refundKop,
        orderTotalKop,
      })
      await notifyAdminsRefundPartial(orderId, refundAmountNum, orderTotal).catch((err) => {
        log.error?.('[yk-refund] partial notify failed', err)
      })
      return
    }

    const client = await pool.connect()
    let applied = false
    try {
      await client.query('BEGIN')
      const locked = await client.query<{ status: string }>(
        `SELECT status FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId],
      )
      const previousStatus = locked.rows[0]?.status
      if (!previousStatus) {
        await client.query('ROLLBACK')
        log.warn?.('[yk-refund] order missing under lock', { orderId })
        return
      }

      if (isTerminalOrderStatus(previousStatus)) {
        await client.query('COMMIT')
        log.log?.('[yk-refund] already terminal, skip', {
          orderId,
          status: previousStatus,
          refundId: input.refundId,
        })
        return
      }

      await client.query(
        `UPDATE orders SET status = $1, is_draft = FALSE, updated_at = NOW() WHERE id = $2`,
        [ORDER_STATUS_RETURNED, orderId],
      )
      await settleOrderStockOnStatusChange(client, {
        orderId,
        previousStatus,
        newStatus: ORDER_STATUS_RETURNED,
        actor: { type: 'system' },
      })
      await client.query('COMMIT')
      applied = true
      log.log?.('[yk-refund] full refund settled', {
        orderId,
        refundId: input.refundId,
        previousStatus,
      })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }

    if (applied) {
      await notifyAdminsRefundFull(orderId).catch((err) => {
        log.error?.('[yk-refund] full notify failed', err)
      })
    }
  } catch (error) {
    log.error?.('[yk-refund] handleRefundSucceeded failed', {
      paymentId: input.paymentId,
      refundId: input.refundId,
      error,
    })
  }
}
