import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockQuery = vi.fn()

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
    connect: vi.fn(),
  },
}))

import {
  importCatalogProductsFromRows,
  normalizeProductFromSheetRow,
} from './google-sync'

describe('google-sync import helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('normalizeProductFromSheetRow returns product without Drive images', () => {
    const product = normalizeProductFromSheetRow({
      'артикул товара для сайта': 'MU0001',
      'наименование товара': 'Test Item',
      'раздел каталога 1-й уровень': 'Декор',
      'стоимость (без ндс) (руб.)': '1000',
      'фактический остаток': '5',
    })

    expect(product).not.toBeNull()
    expect(product?.sku).toBe('MU0001')
    expect(product?.imageUrls).toEqual([])
  })

  it('normalizeProductFromSheetRow returns null for invalid row', () => {
    const product = normalizeProductFromSheetRow({
      'наименование товара': 'No SKU',
    })
    expect(product).toBeNull()
  })

  it('importCatalogProductsFromRows dry-run classifies create and update', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ sku: 'MU0001' }] })

    const result = await importCatalogProductsFromRows(
      [
        {
          'артикул товара для сайта': 'MU0001',
          'наименование товара': 'Existing',
          'раздел каталога 1-й уровень': 'Декор',
        },
        {
          'артикул товара для сайта': 'MU0002',
          'наименование товара': 'New',
          'раздел каталога 1-й уровень': 'Декор',
        },
        { 'наименование товара': 'Invalid' },
      ],
      { dryRun: true },
    )

    expect(result.dryRun).toBe(true)
    expect(result.parsed).toBe(2)
    expect(result.created).toBe(1)
    expect(result.updated).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toBe('Invalid row')
  })
})
