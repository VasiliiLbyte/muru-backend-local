import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: { yookassa: { verifyIp: true } },
}))

vi.mock('../utils/env', () => ({
  env: mockEnv,
}))

vi.mock('../services/yookassa/order-from-payment.service', () => ({
  fulfillPaidPayment: vi.fn(),
  markPaymentCanceled: vi.fn(),
}))

import { yookassaIpGuard } from './yookassa-webhook.controller'

const makeReq = (ip: string) => ({ ip }) as Parameters<typeof yookassaIpGuard>[0]
const makeRes = () => {
  const res = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code
      return this
    },
    end: vi.fn(),
  }
  return res as unknown as Parameters<typeof yookassaIpGuard>[1] & {
    statusCode: number
    end: ReturnType<typeof vi.fn>
  }
}

describe('yookassaIpGuard', () => {
  beforeEach(() => {
    mockEnv.yookassa.verifyIp = true
  })

  it('calls next when verifyIp is false regardless of IP', () => {
    mockEnv.yookassa.verifyIp = false
    const next = vi.fn()
    yookassaIpGuard(makeReq('1.2.3.4'), makeRes(), next)
    expect(next).toHaveBeenCalled()
  })

  it('returns 404 when verifyIp is true and IP is not in allowlist', () => {
    const next = vi.fn()
    const res = makeRes()
    yookassaIpGuard(makeReq('1.2.3.4'), res, next)
    expect(res.statusCode).toBe(404)
    expect(res.end).toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next when verifyIp is true and IP is in allowlist', () => {
    const next = vi.fn()
    const res = makeRes()
    yookassaIpGuard(makeReq('185.71.76.1'), res, next)
    expect(next).toHaveBeenCalled()
  })
})
