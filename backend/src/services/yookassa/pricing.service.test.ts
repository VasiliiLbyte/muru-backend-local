import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../utils/db', () => ({
  pool: { query: vi.fn() },
}))

vi.mock('../../utils/env', () => ({
  env: { cdek: { tariffDoor: 137, tariffPvz: 136 } },
}))

vi.mock('../promo.service', () => ({
  PromoValidationError: class PromoValidationError extends Error {
    name = 'PromoValidationError'
  },
  validatePromoCode: vi.fn(),
}))

vi.mock('../cdek/packaging.service', () => ({
  buildPackagesFromCart: vi.fn(),
}))

vi.mock('../cdek/calc.service', () => ({
  calculateTariff: vi.fn(),
}))

import { pool } from '../../utils/db'
import { calculateTariff } from '../cdek/calc.service'
import { buildPackagesFromCart } from '../cdek/packaging.service'
import { PromoValidationError, validatePromoCode } from '../promo.service'
import {
  computeTrustedPricing,
  PaymentPricingError,
} from './pricing.service'

const poolQueryMock = vi.mocked(pool.query)
const validatePromoMock = vi.mocked(validatePromoCode)
const buildPackagesMock = vi.mocked(buildPackagesFromCart)
const calculateTariffMock = vi.mocked(calculateTariff)

const baseInput = {
  telegramUserId: 123,
  items: [{ sku: 'MU0001', quantity: 2 }],
  deliveryMode: 'pickup' as const,
  promoCode: null,
  cdekTariffCode: null,
  cdekCityCode: null,
}

describe('computeTrustedPricing', () => {
  beforeEach(() => {
    poolQueryMock.mockReset()
    validatePromoMock.mockReset()
    buildPackagesMock.mockReset()
    calculateTariffMock.mockReset()
  })

  it('uses product price from DB, not client-supplied values', async () => {
    poolQueryMock.mockResolvedValue({
      rows: [{ sku: 'MU0001', name: 'Ваза', price: '5000', in_stock: 5 }],
    } as never)

    const result = await computeTrustedPricing(baseInput)

    expect(result.items[0].price).toBe(5000)
    expect(result.items[0].name).toBe('Ваза')
    expect(result.subtotal).toBe(10_000)
    expect(result.deliveryPrice).toBe(0)
    expect(result.total).toBe(10_000)
    expect(buildPackagesMock).not.toHaveBeenCalled()
  })

  it('throws PaymentPricingError for unknown sku', async () => {
    poolQueryMock.mockResolvedValue({ rows: [] } as never)

    await expect(computeTrustedPricing(baseInput)).rejects.toBeInstanceOf(PaymentPricingError)
  })

  it('computes delivery via CDEK for delivery mode', async () => {
    poolQueryMock.mockResolvedValue({
      rows: [{ sku: 'MU0001', name: 'Ваза', price: '1000', in_stock: 1 }],
    } as never)
    buildPackagesMock.mockResolvedValue([{ weight: 500 }])
    calculateTariffMock.mockResolvedValue({
      tariffCode: 137,
      deliverySum: 350,
      periodMin: 2,
      periodMax: 4,
    })

    const result = await computeTrustedPricing({
      ...baseInput,
      deliveryMode: 'delivery',
      cdekTariffCode: 137,
      cdekCityCode: 137,
    })

    expect(result.deliveryPrice).toBe(350)
    expect(result.total).toBe(2350)
    expect(calculateTariffMock).toHaveBeenCalledWith(
      expect.objectContaining({ tariffCode: 137, toCityCode: 137 }),
    )
  })

  it('rejects invalid tariff code', async () => {
    poolQueryMock.mockResolvedValue({
      rows: [{ sku: 'MU0001', name: 'Ваза', price: '1000', in_stock: 1 }],
    } as never)

    await expect(
      computeTrustedPricing({
        ...baseInput,
        deliveryMode: 'delivery',
        cdekTariffCode: 999,
        cdekCityCode: 137,
      }),
    ).rejects.toBeInstanceOf(PaymentPricingError)
  })

  it('throws PromoValidationError when promo is invalid', async () => {
    poolQueryMock.mockResolvedValue({
      rows: [{ sku: 'MU0001', name: 'Ваза', price: '1000', in_stock: 1 }],
    } as never)
    validatePromoMock.mockResolvedValue({ valid: false, reason: 'Промокод не найден' })

    await expect(
      computeTrustedPricing({ ...baseInput, promoCode: 'FAKE' }),
    ).rejects.toBeInstanceOf(PromoValidationError)
  })

  it('applies valid promo discount from server validation', async () => {
    poolQueryMock.mockResolvedValue({
      rows: [{ sku: 'MU0001', name: 'Ваза', price: '1000', in_stock: 1 }],
    } as never)
    validatePromoMock.mockResolvedValue({
      valid: true,
      promoCodeId: 1,
      code: 'SALE10',
      discountType: 'fixed',
      discountValue: 100,
    })

    const result = await computeTrustedPricing({ ...baseInput, promoCode: 'SALE10' })

    expect(result.promoCode).toBe('SALE10')
    expect(result.promoDiscount).toBe(100)
    expect(result.total).toBe(1900)
  })
})
