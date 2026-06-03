import type { NextFunction, Request, Response } from 'express'
import ipRangeCheck from 'ip-range-check'

import {
  fulfillPaidPayment,
  markPaymentCanceled,
} from '../services/yookassa/order-from-payment.service'
import { env } from '../utils/env'

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

export const yookassaIpGuard = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip ?? ''
  log.log?.('[yk-webhook] from ip', ip)
  if (!env.yookassa.verifyIp) {
    return next()
  }
  const allowed = ipRangeCheck(ip, YK_IP_ALLOWLIST)
  if (!allowed) {
    return res.status(404).end()
  }
  next()
}

export const yookassaWebhookHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = req.body?.event as string | undefined
    const object = req.body?.object as { id?: string; status?: string } | undefined

    res.status(200).json({ ok: true })

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
