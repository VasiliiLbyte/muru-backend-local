import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockQuery = vi.fn()
const mockConnect = vi.fn()
const mockClientQuery = vi.fn()
const mockSettle = vi.fn()

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
    connect: (...args: unknown[]) => mockConnect(...args),
  },
}))

vi.mock('./stock-movements.service', () => ({
  settleOrderStockOnStatusChange: (...args: unknown[]) => mockSettle(...args),
}))

import { cancelCrmOrder, getCrmOrderById, listCrmOrders, updateCrmOrder } from './crm-orders.service'

const detailRow = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  channel: 'web',
  telegram_user_id: null,
  status: 'Отменён',
  total: '100',
  subtotal: '100',
  delivery_mode: 'pickup',
  delivery_option: null,
  delivery_price: '0',
  delivery_eta: null,
  address: '',
  comment: '',
  admin_comment: '',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  promo_code: null,
  promo_discount: '0',
  consent_accepted: true,
  consent_version: null,
  consent_accepted_at: null,
  cdek_tariff_code: null,
  cdek_to_city_code: null,
  cdek_to_city_name: null,
  cdek_pvz_code: null,
  cdek_pvz_address: null,
  cdek_recipient_name: null,
  cdek_recipient_phone: null,
  cdek_sync_state: 'none',
  cdek_uuid: null,
  cdek_track_number: null,
  cdek_status: null,
  cdek_status_updated_at: null,
  cdek_create_error: null,
  payment_id: null,
  payment_status: null,
  paid_at: null,
  customer_name: null,
  customer_phone: null,
  customer_email: null,
  items_count: '0',
  ...overrides,
})

describe('crm-orders.service channel-aware mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps web order contacts from cdek_recipient fields', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            channel: 'web',
            telegram_user_id: null,
            status: 'Новый',
            total: '1500.00',
            delivery_mode: 'delivery',
            created_at: '2026-01-01T00:00:00.000Z',
            items_count: '2',
            customer_name: 'Web Name',
            customer_phone: '+79991112233',
            payment_status: 'succeeded',
            paid_at: '2026-01-02T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ status: 'Новый', count: '1' }] })

    const result = await listCrmOrders({ channel: 'web' })
    expect(result.items[0]?.customerName).toBe('Web Name')
    expect(result.items[0]?.customerPhone).toBe('+79991112233')
  })

  it('statusCounts query keeps channel filter without status filter', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    await listCrmOrders({ channel: 'web', status: 'Новый' })

    const statusCountsSql = String(mockQuery.mock.calls[2][0])
    const statusCountsParams = mockQuery.mock.calls[2][1] as unknown[]

    expect(statusCountsSql).toContain('o.channel = $1')
    expect(statusCountsSql).not.toContain('o.status =')
    expect(statusCountsParams).toEqual(['web'])
  })

  it('listCrmOrders with status=active applies ANY filter to list but not statusCounts', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '2' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    await listCrmOrders({ status: 'active', page: 1, pageSize: 10 })

    const listSql = String(mockQuery.mock.calls[1][0])
    const listParams = mockQuery.mock.calls[1][1] as unknown[]
    const statusCountsSql = String(mockQuery.mock.calls[2][0])

    expect(listSql).toContain('ANY')
    expect(listParams).toContainEqual(['Новый', 'Собирается', 'В пути'])
    expect(statusCountsSql).not.toContain('ANY')
    expect(statusCountsSql).not.toContain('o.status =')
  })

  it('getCrmOrderById returns customerEmail from row', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [detailRow({ customer_email: 'buyer@example.com' })],
      })
      .mockResolvedValueOnce({ rows: [] })

    const order = await getCrmOrderById(5)

    expect(order?.customerEmail).toBe('buyer@example.com')
  })

  it('getCrmOrderById maps null customer_email to null', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [detailRow()] })
      .mockResolvedValueOnce({ rows: [] })

    const order = await getCrmOrderById(5)

    expect(order?.customerEmail).toBeNull()
  })
})

describe('cancelCrmOrder / updateCrmOrder stock settlement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettle.mockResolvedValue(undefined)
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: vi.fn(),
    })
  })

  it('cancelCrmOrder settles stock from active status', async () => {
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('FOR UPDATE')) return { rows: [{ status: 'Новый' }] }
      return { rows: [] }
    })
    mockQuery
      .mockResolvedValueOnce({ rows: [detailRow()] })
      .mockResolvedValueOnce({ rows: [] })

    await cancelCrmOrder(5)

    expect(mockSettle).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orderId: 5,
        previousStatus: 'Новый',
        newStatus: 'Отменён',
        actor: { type: 'system' },
      }),
    )
  })

  it('cancelCrmOrder returns 409 when already terminal Возврат', async () => {
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('FOR UPDATE')) return { rows: [{ status: 'Возврат' }] }
      return { rows: [] }
    })

    await expect(cancelCrmOrder(5)).rejects.toMatchObject({
      message: 'Заказ уже в терминальном статусе.',
      statusCode: 409,
    })
    expect(mockSettle).not.toHaveBeenCalled()
  })

  it('updateCrmOrder PATCH Возврат settles stock', async () => {
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('FOR UPDATE')) return { rows: [{ status: 'Собирается' }] }
      return { rows: [] }
    })
    mockQuery
      .mockResolvedValueOnce({ rows: [detailRow({ id: 8, status: 'Возврат' })] })
      .mockResolvedValueOnce({ rows: [] })

    await updateCrmOrder(8, {
      status: 'Возврат',
      actor: { type: 'admin', adminId: 1, label: 'a@muru.ru' },
    })

    expect(mockSettle).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orderId: 8,
        previousStatus: 'Собирается',
        newStatus: 'Возврат',
        actor: { type: 'admin', adminId: 1, label: 'a@muru.ru' },
      }),
    )
  })

  it('updateCrmOrder PATCH Отменён settles stock', async () => {
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('FOR UPDATE')) return { rows: [{ status: 'Новый' }] }
      return { rows: [] }
    })
    mockQuery
      .mockResolvedValueOnce({ rows: [detailRow({ id: 9 })] })
      .mockResolvedValueOnce({ rows: [] })

    await updateCrmOrder(9, { status: 'Отменён' })

    expect(mockSettle).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orderId: 9,
        previousStatus: 'Новый',
        newStatus: 'Отменён',
      }),
    )
  })
})
