import { describe, expect, it } from 'vitest'

import {
  buildProductSlug,
  isNewArrivalFromCollection,
  parseImportCsv,
  parseImportRow,
  resolveCategoryName,
  type ImportParity38RawRow,
} from './import-parity-38.helpers'

const baseRaw = (overrides: Partial<ImportParity38RawRow> = {}): ImportParity38RawRow => ({
  sku: 'MU0296',
  name: 'Стеклянный бокал',
  price: '1100',
  stock: '60',
  discount_percent: '0',
  category: 'Кухня и столовая',
  subcategory: 'Бокалы',
  color: 'Прозрачный',
  size: '8,2×10,4',
  collection: 'Новинки',
  ...overrides,
})

describe('import-parity-38.helpers', () => {
  it('aliases Флористика для дома → Флористика', () => {
    expect(resolveCategoryName('Флористика для дома')).toBe('Флористика')
    expect(resolveCategoryName('Кухня и столовая')).toBe('Кухня и столовая')
  })

  it('builds unique slug with sku prefix', () => {
    expect(buildProductSlug('MU0299', 'Вилка')).toBe('mu0299-vilka')
    expect(buildProductSlug('MU0302', 'Вилка')).toBe('mu0302-vilka')
  })

  it('detects Новинки collection', () => {
    expect(isNewArrivalFromCollection('Новинки')).toBe(true)
    expect(isNewArrivalFromCollection(' Новинки ')).toBe(true)
    expect(isNewArrivalFromCollection('')).toBe(false)
    expect(isNewArrivalFromCollection('Лето')).toBe(false)
  })

  it('skips STUB rows without name/price', () => {
    expect(parseImportRow(baseRaw({ name: '', price: '' }))).toBeNull()
    expect(parseImportRow(baseRaw({ name: 'X', price: '' }))).toBeNull()
  })

  it('parses REAL row with floor stock and dimensionsLabel', () => {
    const row = parseImportRow(baseRaw({ stock: '60.9', discount_percent: '5' }))
    expect(row).toMatchObject({
      sku: 'MU0296',
      inStock: 60,
      discountPercent: 5,
      isNewArrival: true,
      dimensionsLabel: '8,2×10,4',
      resolvedCategoryName: 'Кухня и столовая',
      slug: 'mu0296-steklyannyy-bokal',
    })
  })

  it('parses CSV with quoted commas', () => {
    const csv = [
      'sku,name,price,stock,discount_percent,category,subcategory,color,size,collection',
      'MU0296,Стеклянный бокал,1100,60,0,Кухня и столовая,Бокалы,"Прозрачный, янтарное основание","8,2×10,4",Новинки',
    ].join('\n')
    const rows = parseImportCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].color).toBe('Прозрачный, янтарное основание')
    expect(parseImportRow(rows[0])?.isNewArrival).toBe(true)
  })
})
