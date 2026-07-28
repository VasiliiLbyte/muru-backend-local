import { describe, expect, it } from 'vitest'

import {
  parseBackfillArgs,
  parseCsvLine,
  planProductSlugBackfill,
} from './backfill-product-slugs.helpers'

describe('backfill-product-slugs helpers', () => {
  it('parseBackfillArgs defaults force=false', () => {
    expect(parseBackfillArgs([])).toEqual({ force: false })
    expect(parseBackfillArgs(['--force'])).toEqual({ force: true })
  })

  it('parseCsvLine respects quoted commas', () => {
    expect(parseCsvLine('MU0001,"a, b",x')).toEqual(['MU0001', 'a, b', 'x'])
  })

  it('skips rows that already have slug (idempotent)', () => {
    const csv = new Map([['MU0001', 'from-csv']])
    const plan = planProductSlugBackfill(
      [
        { sku: 'MU0001', name: 'A', slug: 'from-csv' },
        { sku: 'MU0002', name: 'Ваза', slug: 'vaza' },
      ],
      csv,
      { force: false },
    )
    expect(plan.updates).toHaveLength(0)
    expect(plan.skipped).toBe(2)
  })

  it('uses CSV final_slug and autotranslit for others with -2 collision', () => {
    const csv = new Map([['MU0001', 'csv-slug']])
    const plan = planProductSlugBackfill(
      [
        { sku: 'MU0002', name: 'Ваза', slug: null },
        { sku: 'MU0001', name: 'Other', slug: null },
        { sku: 'MU0003', name: 'Ваза', slug: null },
      ],
      csv,
      { force: false },
    )
    expect(plan.fromCsv).toBe(1)
    expect(plan.auto).toBe(2)
    const bySku = Object.fromEntries(plan.updates.map((u) => [u.sku, u.slug]))
    expect(bySku.MU0001).toBe('csv-slug')
    expect(bySku.MU0002).toBe('vaza')
    expect(bySku.MU0003).toBe('vaza-2')
  })
})
