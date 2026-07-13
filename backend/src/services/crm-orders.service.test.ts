import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockQuery = vi.fn()

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
    connect: vi.fn(),
  },
}))

import { listCrmOrders } from './crm-orders.service'

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

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      channel: 'web',
      telegramUserId: null,
      customerName: 'Web Name',
      customerPhone: '+79991112233',
      paymentStatus: 'succeeded',
    })
    expect(mockQuery.mock.calls[0][0]).toContain('o.channel = $1')
    expect(mockQuery.mock.calls[0][1]).toEqual(['web'])
  })

  it('maps telegram order contacts from user_profiles', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            channel: 'telegram',
            telegram_user_id: '42',
            status: 'Новый',
            total: '800.00',
            delivery_mode: 'pickup',
            created_at: '2026-01-01T00:00:00.000Z',
            items_count: '1',
            customer_name: 'Tg User',
            customer_phone: '+70001112233',
            payment_status: null,
            paid_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ status: 'Новый', count: '1' }] })

    const result = await listCrmOrders({})

    expect(result.items[0]).toMatchObject({
      channel: 'telegram',
      telegramUserId: 42,
      customerName: 'Tg User',
      customerPhone: '+70001112233',
    })
  })

  it('statusCounts query respects channel but not status filter', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          { status: 'Новый', count: '3' },
          { status: 'Подтверждён', count: '1' },
        ],
      })

    await listCrmOrders({ channel: 'web', status: 'Новый' })

    const statusCountsSql = String(mockQuery.mock.calls[2][0])
    const statusCountsParams = mockQuery.mock.calls[2][1] as unknown[]

    expect(statusCountsSql).toContain('o.channel = $1')
    expect(statusCountsSql).not.toContain('o.status =')
    expect(statusCountsParams).toEqual(['web'])
  })
})
