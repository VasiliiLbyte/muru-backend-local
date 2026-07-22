import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetYkPayment = vi.fn()
const mockCreateOrder = vi.fn()
const mockPoolConnect = vi.fn()
const mockPoolQuery = vi.fn()

vi.mock('./client', () => ({
  getYkPayment: (...args: unknown[]) => mockGetYkPayment(...args),
}))

vi.mock('../orders.service', () => ({
  createOrder: (...args: unknown[]) => mockCreateOrder(...args),
}))

vi.mock('../google-sheets-write.service', () => ({
  decreaseStockInSheets: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../order-notifications.service', () => ({
  notifyAdminsPaymentReceived: vi.fn().mockResolvedValue(undefined),
  notifyClientPaymentReceived: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../utils/env', () => ({
  env: { enableSheetsStockWrite: false, yookassa: { enabled: true } },
}))

vi.mock('../../utils/db', () => ({
  pool: {
    connect: () => mockPoolConnect(),
    query: (...args: unknown[]) => mockPoolQuery(...args),
  },
}))

import { fulfillPaidPayment, fulfillPaidIntent, validatePreCheckoutIntent, _snapshotToOrderInputForTests } from './order-from-payment.service'

const snap = {
  telegramUserId: 123,
  channel: 'telegram' as const,
  items: [{ sku: 'MU0001', name: 'Vase', price: 1000, quantity: 1 }],
  subtotal: 1000,
  deliveryPrice: 0,
  promoCode: null,
  promoDiscount: 0,
  total: 1000,
  deliveryMode: 'pickup' as const,
  deliveryOption: null,
  deliveryEta: null,
  address: '',
  comment: '',
  birthDate: null,
  recipientName: 'Test User',
  recipientPhone: '+79001234567',
  email: null,
  customerId: null,
  cdekTariffCode: null,
  cdekCityCode: null,
  cdekCityName: null,
  cdekPvzCode: null,
  cdekPvzAddress: null,
}

describe('fulfillPaidPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPoolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT channel FROM payments')) {
        return { rows: [{ channel: 'telegram' }] }
      }
      return { rows: [] }
    })
    mockGetYkPayment.mockResolvedValue({
      id: 'yk-1',
      status: 'succeeded',
      paid: true,
      amount: { value: '1000.00', currency: 'RUB' },
    })
    mockCreateOrder.mockResolvedValue({
      id: 99,
      telegramUserId: 123,
      total: 1000,
      items: snap.items,
    })
  })

  it('returns null when YooKassa payment is not succeeded', async () => {
    mockGetYkPayment.mockResolvedValue({ id: 'yk-1', status: 'pending', paid: false })
    const result = await fulfillPaidPayment('yk-1')
    expect(result).toBeNull()
    expect(mockPoolConnect).not.toHaveBeenCalled()
  })

  it('returns existing order_id without calling createOrder', async () => {
    const client = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
        return {
          rows: [{ id: 1, order_id: 42, status: 'pending', checkout_snapshot: snap }],
        }
      }),
      release: vi.fn(),
    }
    mockPoolConnect.mockResolvedValue(client)

    const result = await fulfillPaidPayment('yk-paid')
    expect(result).toBe(42)
    expect(mockCreateOrder).not.toHaveBeenCalled()
  })

  it('creates order and links payment when not yet fulfilled', async () => {
    const client = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
        if (sql.includes('FOR UPDATE')) {
          return { rows: [{ id: 1, order_id: null, status: 'pending', checkout_snapshot: snap }] }
        }
        if (sql.includes("status='succeeded'")) return { rows: [] }
        return { rows: [] }
      }),
      release: vi.fn(),
    }
    mockPoolConnect.mockResolvedValue(client)
    mockPoolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT channel FROM payments')) {
        return { rows: [{ channel: 'telegram' }] }
      }
      if (sql.includes('order_id IS NULL RETURNING')) {
        return { rows: [{ id: 1 }] }
      }
      return { rows: [] }
    })

    const result = await fulfillPaidPayment('yk-new')
    expect(result).toBe(99)
    expect(mockCreateOrder).toHaveBeenCalledOnce()
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('order_id IS NULL RETURNING'),
      [99, 1],
    )
  })

  it('ignores duplicate fulfill when payment already linked', async () => {
    const client = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
        if (sql.includes('FOR UPDATE')) {
          return { rows: [{ id: 1, order_id: null, status: 'pending', checkout_snapshot: snap }] }
        }
        if (sql.includes("status='succeeded'")) return { rows: [] }
        return { rows: [] }
      }),
      release: vi.fn(),
    }
    mockPoolConnect.mockResolvedValue(client)
    mockPoolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT channel FROM payments')) {
        return { rows: [{ channel: 'telegram' }] }
      }
      if (sql.includes('order_id IS NULL RETURNING')) return { rows: [] }
      if (sql.includes('SELECT order_id FROM payments')) return { rows: [{ order_id: 42 }] }
      return { rows: [] }
    })

    const result = await fulfillPaidPayment('yk-dup')
    expect(result).toBe(42)
    expect(mockCreateOrder).toHaveBeenCalledOnce()
  })
})

describe('fulfillPaidIntent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateOrder.mockResolvedValue({
      id: 99,
      telegramUserId: 123,
      total: 1000,
      items: snap.items,
    })
  })

  it('returns existing order_id without calling createOrder', async () => {
    const client = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
        return { rows: [{ id: 7, order_id: 42, checkout_snapshot: snap }] }
      }),
      release: vi.fn(),
    }
    mockPoolConnect.mockResolvedValue(client)

    const result = await fulfillPaidIntent(7, 'tg-charge-1')
    expect(result).toBe(42)
    expect(mockCreateOrder).not.toHaveBeenCalled()
  })

  it('creates order from intent when not yet fulfilled', async () => {
    const client = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
        if (sql.includes('FOR UPDATE')) {
          return { rows: [{ id: 7, order_id: null, checkout_snapshot: snap }] }
        }
        return { rows: [] }
      }),
      release: vi.fn(),
    }
    mockPoolConnect.mockResolvedValue(client)
    mockPoolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('order_id IS NULL RETURNING')) {
        return { rows: [{ id: 7 }] }
      }
      return { rows: [] }
    })

    const result = await fulfillPaidIntent(7, 'tg-charge-new')
    expect(result).toBe(99)
    expect(mockCreateOrder).toHaveBeenCalledOnce()
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('order_id IS NULL RETURNING'),
      [99, 7],
    )
  })
})

describe('validatePreCheckoutIntent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts valid pending intent', async () => {
    mockPoolQuery.mockResolvedValue({
      rows: [{ status: 'pending', telegram_user_id: '123', amount: '1000.00' }],
    })
    const result = await validatePreCheckoutIntent(7, 123, 100000)
    expect(result).toEqual({ ok: true })
  })

  it('rejects mismatched amount', async () => {
    mockPoolQuery.mockResolvedValue({
      rows: [{ status: 'pending', telegram_user_id: '123', amount: '1000.00' }],
    })
    const result = await validatePreCheckoutIntent(7, 123, 99999)
    expect(result).toEqual({ ok: false, errorMessage: 'Сумма не совпадает' })
  })
})

describe('snapshotToOrderInput customer fields', () => {
  it('maps customerId, normalized email and phone from web snapshot', () => {
    const input = _snapshotToOrderInputForTests(
      {
        ...snap,
        channel: 'web',
        telegramUserId: null,
        email: '  Buyer@Example.COM ',
        customerId: 42,
        recipientPhone: '89001234567',
      },
      'yk-charge-1',
    )
    expect(input.customerId).toBe(42)
    expect(input.customerEmail).toBe('buyer@example.com')
    expect(input.customerPhone).toBe('+79001234567')
  })

  it('keeps customerId null for guest and still maps email/phone', () => {
    const input = _snapshotToOrderInputForTests(
      {
        ...snap,
        channel: 'web',
        telegramUserId: null,
        email: 'guest@example.com',
        customerId: null,
        recipientPhone: '+79007654321',
      },
      'yk-guest',
    )
    expect(input.customerId).toBeNull()
    expect(input.customerEmail).toBe('guest@example.com')
    expect(input.customerPhone).toBe('+79007654321')
  })
})
