import { describe, expect, it } from 'vitest'

import { PRODUCT_UPSERT_PARAM_COUNT, PRODUCT_UPSERT_VALUES_SQL } from './google-sync-upsert-sql'

const countPlaceholders = (sql: string): number => {
  const matches = sql.match(/\$\d+/g)
  if (!matches) return 0
  return new Set(matches).size
}

describe('product upsert SQL placeholders', () => {
  it('keeps in_stock as integer ($6) and specs as jsonb ($7) after discount_percent ($5)', () => {
    expect(PRODUCT_UPSERT_VALUES_SQL).toContain('$5,$6,$7::jsonb')
    expect(PRODUCT_UPSERT_VALUES_SQL).not.toMatch(/\$5,\$6::jsonb/)
  })

  it('casts image_urls at $10::jsonb', () => {
    expect(PRODUCT_UPSERT_VALUES_SQL).toContain('$10::jsonb')
  })

  it('has one placeholder per bound parameter', () => {
    expect(countPlaceholders(PRODUCT_UPSERT_VALUES_SQL)).toBe(PRODUCT_UPSERT_PARAM_COUNT)
  })
})
