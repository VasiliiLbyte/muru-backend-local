import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const mockQuery = vi.fn()
const mockConnect = vi.fn()
const mockClientQuery = vi.fn()
const mockApplyStockDelta = vi.fn()

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
    connect: (...args: unknown[]) => mockConnect(...args),
  },
}))

vi.mock('../utils/env', () => ({
  env: { catalogSource: 'crm', isCatalogCrmMode: true },
}))

vi.mock('./catalog-source.guard', () => ({
  assertCatalogCrmWritable: vi.fn(),
}))

vi.mock('./stock-movements.service', () => ({
  applyStockDelta: (...args: unknown[]) => mockApplyStockDelta(...args),
}))

import { updateCrmCatalogProductStock } from './crm-catalog.service'

describe('updateCrmCatalogProductStock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyStockDelta.mockResolvedValue({ before: 3, after: 10 })
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: vi.fn(),
    })
  })

  it('applies adjustment delta via applyStockDelta', async () => {
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('FOR UPDATE')) {
        return { rows: [{ sku: 'MU0001', in_stock: 3 }] }
      }
      return { rows: [] }
    })
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 1,
          sku: 'MU0001',
          slug: 'vase',
          name: 'Ваза',
          description: '',
          price: '1000',
          discount_percent: '0',
          in_stock: 10,
          is_archived: false,
          is_gift_guide: false,
          is_new_arrival: false,
          new_arrival_at: null,
          category_id: null,
          category_name: null,
          web_subcategory_name: null,
          web_subcategory_slug: null,
          color: null,
          size: null,
          color_tags: [],
          dimensions_label: '',
          specs: {},
          image_url_1: null,
          image_url_2: null,
          image_urls: [],
          weight_grams: 1000,
          dim_length_cm: 10,
          dim_width_cm: 10,
          dim_height_cm: 10,
          dims_source: 'auto',
          weight_source: 'auto',
          updated_at: '2026-01-01',
        },
      ],
    })

    await updateCrmCatalogProductStock(1, 10, {
      type: 'admin',
      adminId: 2,
      label: 'mgr@muru.ru',
    })

    expect(mockApplyStockDelta).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        productSku: 'MU0001',
        delta: 7,
        type: 'adjustment',
        reason: 'Ручная корректировка',
        actor: { type: 'admin', adminId: 2, label: 'mgr@muru.ru' },
      }),
    )
  })

  it('skips journal when stock unchanged', async () => {
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('FOR UPDATE')) {
        return { rows: [{ sku: 'MU0001', in_stock: 5 }] }
      }
      return { rows: [] }
    })
    mockQuery.mockResolvedValue({ rows: [{ id: 1, sku: 'MU0001', in_stock: 5 }] })

    await updateCrmCatalogProductStock(1, 5)
    expect(mockApplyStockDelta).not.toHaveBeenCalled()
  })
})

describe('google-sync stock path isolation', () => {
  it('upsert SQL sets in_stock without stock_movements / applyStockDelta', () => {
    const upsertSqlPath = path.join(__dirname, 'google-sync.ts')
    const src = readFileSync(upsertSqlPath, 'utf8')
    expect(src).toContain('in_stock = EXCLUDED.in_stock')
    expect(src).not.toContain('applyStockDelta')
    expect(src).not.toContain('stock_movements')
  })
})
