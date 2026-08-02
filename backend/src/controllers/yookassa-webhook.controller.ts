import type { NextFunction, Request, Response } from 'express'
import ipRangeCheck from 'ip-range-check'

import {
  fulfillPaidPayment,
  markPaymentCanceled,
} from '../services/yookassa/order-from-payment.service'
import { handleRefundSucceeded } from '../services/yookassa/refund-webhook.service'
import { getEffectiveConfig } from '../services/runtime-config.service'

const log = console

// Official YooKassa webhook source IPs — verify against https://yookassa.ru/developers/using-api/webhooks
const YK_IP_ALLOWLIST = [
  '185.71.76.0/27',
  '185.71.77.0/27',
  '77.75.153.0/25',
  '77.75.156.11',
  '77.75.156.35',
  '77.75.154.128/25',
  '2a02:5180::/32',
]

export const yookassaIpGuard = async (req: Request, res: Response, next: NextFunction) => {
  const event = req.body?.event as string | undefined
  const object = req.body?.object as { id?: string; payment_id?: string } | undefined
  log.log?.('[yk-webhook] incoming', {
    ip: req.ip,
    xff: req.headers['x-forwarded-for'],
    event,
    paymentId: event === 'refund.succeeded' ? object?.payment_id : object?.id,
    refundId: event === 'refund.succeeded' ? object?.id : undefined,
  })
  const cfg = await getEffectiveConfig()
  if (!cfg.yookassa.verifyIp) {
    return next()
  }
  const ip = req.ip ?? ''
  const allowed = ipRangeCheck(ip, YK_IP_ALLOWLIST)
  if (!allowed) {
    log.warn?.('[yk-webhook] IP blocked', { ip: req.ip })
    return res.status(404).end()
  }
  next()
}

export const yookassaWebhookHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = req.body?.event as string | undefined
    const object = req.body?.object as
      | {
          id?: string
          status?: string
          payment_id?: string
          amount?: { value?: string; currency?: string }
        }
      | undefined

    res.status(200).json({ ok: true })

    if (event === 'refund.succeeded') {
      const paymentId = object?.payment_id
      const refundAmount = object?.amount?.value
      const refundId = object?.id
      log.log?.('[yk-webhook] handled', { event, paymentId, refundId })
      if (!paymentId || !refundAmount) {
        log.warn?.('[yk-webhook] refund.succeeded missing payment_id or amount', {
          paymentId,
          refundAmount,
          refundId,
        })
        return
      }
      try {
        await handleRefundSucceeded({ paymentId, refundAmount, refundId })
      } catch (e) {
        log.error?.('[yk-webhook] refund error', e)
      }
      return
    }

    log.log?.('[yk-webhook] handled', { event, paymentId: object?.id })

    if (!object?.id) return
    const paymentId = object.id

    if (event === 'payment.succeeded') {
      try {
        await fulfillPaidPayment(paymentId)
      } catch (e) {
        log.error?.('[yk-webhook] fulfill error', e)
      }
    } else if (event === 'payment.canceled') {
      try {
        await markPaymentCanceled(paymentId)
      } catch (e) {
        log.error?.('[yk-webhook] cancel error', e)
      }
    }
  } catch (e) {
    next(e)
  }
}
