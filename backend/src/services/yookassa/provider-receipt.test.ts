import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../utils/env', () => ({
  env: {
    cdek: {
      env: 'test',
      clientId: '',
      clientSecret: '',
      webhookSecret: '',
      senderCityCode: 137,
      senderPostalCode: '',
      senderAddress: '',
      senderName: '',
      senderPhone: '',
      tariffDoor: 139,
      tariffPvz: 138,
    },
    yookassa: {
      vatCode: 1,
      verifyIp: true,
      shopId: '',
      secretKey: '',
      webShopId: '',
      webSecretKey: '',
      returnUrl: '',
      webReturnUrl: '',
      enabled: false,
    },
  },
}))

vi.mock('../runtime-config.service', () => ({
  getEffectiveConfig: vi.fn(async () => ({
    cdek: {
      env: 'test' as const,
      clientId: '',
      clientSecret: '',
      webhookSecret: '',
      senderCityCode: 137,
      senderPostalCode: '',
      senderAddress: '',
      senderName: '',
      senderPhone: '',
      tariffDoor: 139,
      tariffPvz: 138,
      defaultWeightGrams: 3000,
      defaultLengthCm: 22,
      defaultWidthCm: 12,
      defaultHeightCm: 18,
    },
    yookassa: {
      vatCode: 1,
      verifyIp: true,
      shopId: '',
      secretKey: '',
      webShopId: '',
      webSecretKey: '',
      returnUrl: '',
      webReturnUrl: '',
      enabled: false,
    },
  })),
  invalidateRuntimeConfigCache: vi.fn(),
  setRuntimeConfigInvalidateHook: vi.fn(),
}))

import { buildProviderData } from './provider-receipt'
import { receiptTotalKop } from './receipt'

describe('buildProviderData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns valid JSON with receipt wrapper', async () => {
    const productItems = [{ description: 'Vase', priceKop: 100000, quantity: 1 }]
    const deliveryKop = 50000
    const discountKop = 0

    const raw = await buildProviderData({
      phone: '+79001234567',
      productItems,
      deliveryKop,
      discountKop,
    })

    const parsed = JSON.parse(raw) as { receipt: { items: unknown[] } }
    expect(parsed.receipt).toBeDefined()
    expect(Array.isArray(parsed.receipt.items)).toBe(true)
    expect(parsed.receipt.items.length).toBeGreaterThan(0)
  })

  it('receipt total matches receiptTotalKop', async () => {
    const productItems = [
      { description: 'Vase', priceKop: 100000, quantity: 1 },
      { description: 'Bowl', priceKop: 50000, quantity: 2 },
    ]
    const deliveryKop = 30000
    const discountKop = 10000

    const raw = await buildProviderData({
      phone: '+79001234567',
      productItems,
      deliveryKop,
      discountKop,
    })

    const parsed = JSON.parse(raw) as {
      receipt: { items: { amount: { value: string } }[] }
    }
    const itemsSumKop = parsed.receipt.items.reduce(
      (sum, item) => sum + Math.round(Number(item.amount.value) * 100),
      0,
    )
    const expected = receiptTotalKop({ productItems, deliveryKop, discountKop })
    expect(itemsSumKop).toBe(expected)
  })
})
