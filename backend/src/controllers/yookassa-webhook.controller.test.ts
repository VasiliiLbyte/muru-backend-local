import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetEffectiveConfig } = vi.hoisted(() => ({
  mockGetEffectiveConfig: vi.fn(async () => ({
    yookassa: { verifyIp: true },
  })),
}))

const mockFulfill = vi.fn()
const mockCancel = vi.fn()
const mockHandleRefund = vi.fn()

vi.mock('../services/runtime-config.service', () => ({
  getEffectiveConfig: (...args: unknown[]) => mockGetEffectiveConfig(...args),
}))

vi.mock('../services/yookassa/order-from-payment.service', () => ({
  fulfillPaidPayment: (...args: unknown[]) => mockFulfill(...args),
  markPaymentCanceled: (...args: unknown[]) => mockCancel(...args),
}))

vi.mock('../services/yookassa/refund-webhook.service', () => ({
  handleRefundSucceeded: (...args: unknown[]) => mockHandleRefund(...args),
}))

import { yookassaIpGuard, yookassaWebhookHandler } from './yookassa-webhook.controller'

const makeReq = (
  ip: string,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) =>
  ({
    ip,
    body,
    headers,
  }) as Parameters<typeof yookassaIpGuard>[0]

const makeRes = () => {
  const res = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code
      return this
    },
    end: vi.fn(),
    json: vi.fn().mockReturnThis(),
  }
  return res as unknown as Parameters<typeof yookassaIpGuard>[1] & {
    statusCode: number
    end: ReturnType<typeof vi.fn>
    json: ReturnType<typeof vi.fn>
  }
}

describe('yookassaIpGuard', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockGetEffectiveConfig.mockResolvedValue({ yookassa: { verifyIp: true } })
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  it('always logs incoming request before checks', async () => {
    const next = vi.fn()
    await yookassaIpGuard(
      makeReq(
        '1.2.3.4',
        { event: 'payment.succeeded', object: { id: 'yk-99' } },
        { 'x-forwarded-for': '1.2.3.4' },
      ),
      makeRes(),
      next,
    )
    expect(logSpy).toHaveBeenCalledWith(
      '[yk-webhook] incoming',
      expect.objectContaining({
        ip: '1.2.3.4',
        xff: '1.2.3.4',
        event: 'payment.succeeded',
        paymentId: 'yk-99',
      }),
    )
  })

  it('logs payment_id for refund.succeeded incoming', async () => {
    const next = vi.fn()
    await yookassaIpGuard(
      makeReq('185.71.76.1', {
        event: 'refund.succeeded',
        object: { id: 'rf-1', payment_id: 'yk-pay-1' },
      }),
      makeRes(),
      next,
    )
    expect(logSpy).toHaveBeenCalledWith(
      '[yk-webhook] incoming',
      expect.objectContaining({
        event: 'refund.succeeded',
        paymentId: 'yk-pay-1',
        refundId: 'rf-1',
      }),
    )
  })

  it('calls next when verifyIp is false regardless of IP', async () => {
    mockGetEffectiveConfig.mockResolvedValue({ yookassa: { verifyIp: false } })
    const next = vi.fn()
    await yookassaIpGuard(makeReq('1.2.3.4'), makeRes(), next)
    expect(next).toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('returns 404 and warns when verifyIp is true and IP is not in allowlist', async () => {
    const next = vi.fn()
    const res = makeRes()
    await yookassaIpGuard(makeReq('1.2.3.4'), res, next)
    expect(res.statusCode).toBe(404)
    expect(res.end).toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith('[yk-webhook] IP blocked', { ip: '1.2.3.4' })
  })

  it('calls next when verifyIp is true and IP is in allowlist', async () => {
    const next = vi.fn()
    const res = makeRes()
    await yookassaIpGuard(makeReq('185.71.76.1'), res, next)
    expect(next).toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })
})

describe('yookassaWebhookHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFulfill.mockResolvedValue(99)
    mockCancel.mockResolvedValue(undefined)
    mockHandleRefund.mockResolvedValue(undefined)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('acks 200 and fulfills payment.succeeded with object.id', async () => {
    const res = makeRes()
    await yookassaWebhookHandler(
      makeReq('185.71.76.1', {
        event: 'payment.succeeded',
        object: { id: 'yk-pay-ok' },
      }),
      res,
      vi.fn(),
    )
    expect(res.statusCode).toBe(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
    expect(mockFulfill).toHaveBeenCalledWith('yk-pay-ok')
    expect(mockHandleRefund).not.toHaveBeenCalled()
  })

  it('passes payment_id (not refund id) to handleRefundSucceeded', async () => {
    const res = makeRes()
    await yookassaWebhookHandler(
      makeReq('185.71.76.1', {
        event: 'refund.succeeded',
        object: {
          id: 'rf-1',
          payment_id: 'yk-pay-1',
          amount: { value: '1350.00', currency: 'RUB' },
        },
      }),
      res,
      vi.fn(),
    )
    expect(res.json).toHaveBeenCalledWith({ ok: true })
    expect(mockHandleRefund).toHaveBeenCalledWith({
      paymentId: 'yk-pay-1',
      refundAmount: '1350.00',
      refundId: 'rf-1',
    })
    expect(mockFulfill).not.toHaveBeenCalled()
  })

  it('skips refund handler when payment_id missing', async () => {
    const res = makeRes()
    await yookassaWebhookHandler(
      makeReq('185.71.76.1', {
        event: 'refund.succeeded',
        object: { id: 'rf-1', amount: { value: '10.00' } },
      }),
      res,
      vi.fn(),
    )
    expect(res.json).toHaveBeenCalledWith({ ok: true })
    expect(mockHandleRefund).not.toHaveBeenCalled()
  })
})
