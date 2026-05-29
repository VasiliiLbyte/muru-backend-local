import { describe, expect, it } from 'vitest'

import { buildProductTextSearchCondition } from './catalog-product-search'

describe('buildProductTextSearchCondition', () => {
  it('returns name and sku ILIKE clause and pushes pattern', () => {
    const values: Array<string | number> = []
    const sql = buildProductTextSearchCondition(values, 'MU0042')

    expect(sql).toBe('(p.name ILIKE $1 OR p.sku ILIKE $1)')
    expect(values).toEqual(['%MU0042%'])
  })

  it('returns null for empty or whitespace query', () => {
    const values: Array<string | number> = ['existing']
    expect(buildProductTextSearchCondition(values, '')).toBeNull()
    expect(buildProductTextSearchCondition(values, '   ')).toBeNull()
    expect(values).toEqual(['existing'])
  })

  it('uses next parameter index when values already populated', () => {
    const values: Array<string | number> = ['slug-value']
    const sql = buildProductTextSearchCondition(values, 'ваза')

    expect(sql).toBe('(p.name ILIKE $2 OR p.sku ILIKE $2)')
    expect(values).toEqual(['slug-value', '%ваза%'])
  })
})
