import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPoolQuery = vi.fn()
const mockCallTelegramApi = vi.fn()
const mockComputeTrustedPricing = vi.fn()

vi.mock('../../utils/db', () => ({
  pool: { query: (...args: unknown[]) => mockPoolQuery(...args) },
}))

vi.mock('../../utils/env', () => ({
  env: {
    payments: { nativeEnabled: true },
    telegramProviderToken: 'test-provider-token',
    yookassa: { vatCode: 1 },
  },
}))

vi.mock('../telegram-http.service', () => ({
  callTelegramApi: (...args: unknown[]) => mockCallTelegramApi(...args),
}))

vi.mock('../yookassa/pricing.service', () => ({
  computeTrustedPricing: (...args: unknown[]) => mockComputeTrustedPricing(...args),
}))

import { createInvoiceForCheckout } from './invoice.service'

const rawInput = {
  telegramUserId: 123,
  items: [{ sku: 'MU0001', quantity: 1 }],
  promoCode: null,
  deliveryMode: 'pickup' as const,
  deliveryOption: null,
  deliveryEta: null,
  address: '',
  comment: '',
  birthDate: null,
  recipientName: 'Test User',
  recipientPhone: '+79001234567',
  cdekTariffCode: null,
  cdekCityCode: null,
  cdekCityName: null,
  cdekPvzCode: null,
  cdekPvzAddress: null,
}

describe('createInvoiceForCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPoolQuery.mockReset()
    mockComputeTrustedPricing.mockResolvedValue({
      items: [{ sku: 'MU0001', name: 'Vase', price: 1000, quantity: 1 }],
      subtotal: 1000,
      deliveryPrice: 0,
      promoCode: null,
      promoDiscount: 0,
      total: 1000,
    })
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ id: 7 }] })
      .mockResolvedValueOnce({ rows: [] })
    mockCallTelegramApi.mockResolvedValue('https://t.me/$invoice/abc')
  })

  it('inserts pending payment and returns invoice link', async () => {
    const result = await createInvoiceForCheckout(rawInput)

    expect(result).toEqual({ invoiceUrl: 'https://t.me/$invoice/abc', intentId: 7 })
    expect(result.invoiceUrl.startsWith('https://t.me/$')).toBe(true)
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO payments'),
      expect.arrayContaining(['1000.00', 123]),
    )
    expect(mockCallTelegramApi).toHaveBeenCalledWith(
      'createInvoiceLink',
      expect.objectContaining({
        payload: 'intent:7',
        provider_token: 'test-provider-token',
        prices: [{ label: 'Заказ', amount: 100000 }],
      }),
    )
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('confirmation_url'),
      [7, 'https://t.me/$invoice/abc'],
    )
  })

  it('normalizes telegram.me invoice URLs to t.me', async () => {
    const telegramMeUrl = 'https://telegram.me/$eZBtH8-abc'
    const normalizedUrl = 'https://t.me/$eZBtH8-abc'
    mockCallTelegramApi.mockResolvedValue(telegramMeUrl)

    const result = await createInvoiceForCheckout(rawInput)

    expect(result).toEqual({ invoiceUrl: normalizedUrl, intentId: 7 })
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('confirmation_url'),
      [7, normalizedUrl],
    )
  })

  it('rejects non-t.me invoice URLs from Telegram API', async () => {
    mockCallTelegramApi.mockResolvedValue('https://yookassa.ru/checkout/abc')

    await expect(createInvoiceForCheckout(rawInput)).rejects.toThrow(/invalid invoice URL/i)
  })

  it('rejects t.me URLs without invoice path', async () => {
    mockCallTelegramApi.mockResolvedValue('https://t.me/noinvoice')

    await expect(createInvoiceForCheckout(rawInput)).rejects.toThrow(/invalid invoice URL/i)
  })
})
