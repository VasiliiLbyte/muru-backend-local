import { describe, expect, it, vi } from 'vitest'

import type { Product } from '../types/catalog'

import {
  collectActiveSkus,
  dedupeProductsBySkuLastWins,
  formatStalePurgeWarning,
  purgeProductsAbsentFromSheet,
  shouldPurgeStaleProducts,
} from './google-sync-stale-products'

const product = (sku: string, name = sku): Product => ({
  sku,
  name,
  categoryNames: ['Натуральный декор'],
  price: 100,
  discountPercent: 0,
  inStock: 1,
  description: '',
  specs: {},
  variants: [],
  imageUrls: ['https://example.com/a.webp'],
})

describe('dedupeProductsBySkuLastWins', () => {
  it('keeps the last row for duplicate SKUs', () => {
    const deduped = dedupeProductsBySkuLastWins([
      product('MU0119', 'First'),
      product('MU0130', 'Poster'),
      product('MU0119', 'Second'),
    ])
    expect(deduped).toHaveLength(2)
    expect(deduped.find((p) => p.sku === 'MU0119')?.name).toBe('Second')
  })
})

describe('collectActiveSkus', () => {
  it('returns unique SKUs in stable order', () => {
    expect(collectActiveSkus([product('MU0119'), product('MU0130'), product('MU0119')])).toEqual([
      'MU0119',
      'MU0130',
    ])
  })
})

describe('shouldPurgeStaleProducts', () => {
  it('allows purge only when the sheet snapshot has at least one SKU', () => {
    expect(shouldPurgeStaleProducts([])).toBe(false)
    expect(shouldPurgeStaleProducts(['MU0119'])).toBe(true)
  })
})

describe('formatStalePurgeWarning', () => {
  it('formats deleted SKU sample for admin warnings', () => {
    expect(formatStalePurgeWarning(['MU0122', 'MU0123'])).toBe(
      'Удалено из каталога (нет в таблице): 2 — MU0122, MU0123',
    )
    expect(formatStalePurgeWarning([])).toBeNull()
  })

  it('truncates long delete lists', () => {
    const skus = Array.from({ length: 12 }, (_, i) => `MU${String(1000 + i).slice(-4)}`)
    expect(formatStalePurgeWarning(skus)).toContain('…')
  })
})

describe('purgeProductsAbsentFromSheet', () => {
  it('skips SQL when activeSkus is empty', async () => {
    const query = vi.fn()
    const client = { query } as unknown as import('pg').PoolClient

    const result = await purgeProductsAbsentFromSheet(client, [])

    expect(result).toEqual({ deletedCount: 0, deletedSkus: [] })
    expect(query).not.toHaveBeenCalled()
  })

  it('deletes MU products not present in activeSkus', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ sku: 'MU0122' }, { sku: 'MU0123' }],
    })
    const client = { query } as unknown as import('pg').PoolClient

    const result = await purgeProductsAbsentFromSheet(client, ['MU0119', 'MU0130'])

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("sku LIKE 'MU%'"),
      [['MU0119', 'MU0130']],
    )
    expect(result).toEqual({ deletedCount: 2, deletedSkus: ['MU0122', 'MU0123'] })
  })
})
