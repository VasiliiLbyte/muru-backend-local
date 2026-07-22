import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPoolQuery = vi.fn()
const mockClientQuery = vi.fn()
const mockConnect = vi.fn()

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockPoolQuery(...args),
    connect: () => mockConnect(),
  },
}))

vi.mock('./promo.service', () => ({
  validatePromoCode: vi.fn(),
  normalizePromoCode: (code: string) => code.toUpperCase(),
  applyPromoCodeOnOrder: vi.fn(),
  PromoValidationError: class PromoValidationError extends Error {},
}))

import { createOrder, getOrdersByTelegramUserId } from './orders.service'

describe('getOrdersByTelegramUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPoolQuery.mockResolvedValue({ rows: [] })
  })

  it('excludes drafts and orphan Черновик orders from history', async () => {
    await getOrdersByTelegramUserId(123)

    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('is_draft = FALSE'),
      [123],
    )
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("NOT (status = 'Черновик' AND payment_id IS NULL)"),
      [123],
    )
  })
})

describe('createOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: vi.fn(),
    })
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('INSERT INTO orders')) {
        return {
          rows: [
            {
              id: 50,
              telegram_user_id: '123',
              status: 'Новый',
              delivery_mode: 'pickup',
              delivery_option: null,
              delivery_price: '0',
              delivery_eta: null,
              address: '',
              comment: '',
              birth_date: null,
              subtotal: '1000',
              total: '1000',
              promo_code: null,
              promo_discount: '0',
              cdek_tariff_code: null,
              cdek_to_city_code: null,
              cdek_to_city_name: null,
              cdek_pvz_code: null,
              cdek_pvz_address: null,
              cdek_recipient_name: 'Test',
              cdek_recipient_phone: '+79001234567',
            },
          ],
        }
      }
      return { rows: [] }
    })
    mockPoolQuery.mockResolvedValue({
      rows: [{ product_sku: 'MU0001', product_name: 'Vase', price: '1000', quantity: 1, color: null, size: null }],
    })
  })

  it('deletes user draft orders when creating paid order', async () => {
    await createOrder({
      telegramUserId: 123,
      items: [{ sku: 'MU0001', name: 'Vase', price: 1000, quantity: 1 }],
      deliveryMode: 'pickup',
      deliveryPrice: 0,
      address: '',
      comment: '',
      consentAccepted: true,
      paymentId: 'tg-charge-1',
      paymentStatus: 'succeeded',
    })

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM orders WHERE telegram_user_id = $1 AND is_draft = TRUE'),
      [123],
    )
    expect(mockClientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE orders SET is_draft = FALSE'),
      expect.anything(),
    )
  })

  it('writes customer_id, customer_email, customer_phone on INSERT', async () => {
    await createOrder({
      telegramUserId: null,
      channel: 'web',
      items: [{ sku: 'MU0001', name: 'Vase', price: 1000, quantity: 1 }],
      deliveryMode: 'pickup',
      deliveryPrice: 0,
      address: '',
      comment: '',
      consentAccepted: true,
      paymentId: 'yk-1',
      paymentStatus: 'succeeded',
      customerId: 7,
      customerEmail: 'buyer@example.com',
      customerPhone: '+79001234567',
    })

    const insertCall = mockClientQuery.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO orders'),
    )
    expect(insertCall).toBeDefined()
    expect(insertCall![0]).toContain('customer_id, customer_email, customer_phone')
    expect(insertCall![1]).toEqual(
      expect.arrayContaining([7, 'buyer@example.com', '+79001234567']),
    )
  })
})
