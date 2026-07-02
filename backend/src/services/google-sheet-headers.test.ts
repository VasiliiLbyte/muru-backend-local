import { describe, expect, it } from 'vitest'

import {
  columnIndexToA1,
  findHeaderRowIndex,
  normalizeHeaderKey,
  resolveCatalogSubsection,
  resolveSheetDiscountPercent,
  resolveSheetPrice,
  resolveSkuFromRow,
  rowToRecord,
} from './google-sheet-headers'

describe('normalizeHeaderKey', () => {
  it('lowercases and normalizes cost column title', () => {
    expect(normalizeHeaderKey('Стоимость (без НДС) (руб.)')).toBe('стоимость (без ндс) (руб.)')
  })
})

describe('rowToRecord', () => {
  it('keeps first value when duplicate header keys exist', () => {
    const header = [
      'артикул товара для сайта',
      'раздел каталога 1-й уровень',
      'главный раздел каталога 2-й уровень',
      'раздел каталога 1-й уровень',
    ]
    const row = ['MU0001', 'Вазы и аксессуары', 'Подсвечники', 'Кухня и столовая']
    const record = rowToRecord(header, row)
    expect(record['раздел каталога 1-й уровень']).toBe('Вазы и аксессуары')
  })
})

describe('findHeaderRowIndex', () => {
  it('detects header on second row when first row is auxiliary', () => {
    const rows = [
      ['Не берем для сайта', 'Ш×В'],
      ['№ п/п', 'Наименование товара', 'Артикул товара для сайта'],
      ['1', 'Товар', 'MU0001'],
    ]
    expect(findHeaderRowIndex(rows)).toBe(1)
  })
})

describe('resolveSheetPrice', () => {
  it('reads price from new sheet cost column key', () => {
    const source = { 'стоимость (без ндс) (руб.)': '3 500,00' }
    expect(resolveSheetPrice(source)).toBe('3 500,00')
  })

  it('prefers explicit price keys over cost column', () => {
    const source = {
      цена: '100',
      'стоимость (без ндс) (руб.)': '3 500,00',
    }
    expect(resolveSheetPrice(source)).toBe('100')
  })
})

describe('columnIndexToA1', () => {
  it('maps common column indices', () => {
    expect(columnIndexToA1(0)).toBe('A')
    expect(columnIndexToA1(4)).toBe('E')
    expect(columnIndexToA1(26)).toBe('AA')
  })
})

describe('resolveSkuFromRow', () => {
  it('reads SKU from артикул column', () => {
    const row = rowToRecord(
      ['наименование товара', 'артикул товара для сайта', 'раздел каталога 1-й уровень'],
      ['Подсвечник', 'MU0042', 'Вазы и аксессуары'],
    )
    expect(resolveSkuFromRow(row)).toBe('MU0042')
  })

  it('reads SKU from фото с сайта when columns are shifted', () => {
    const row = rowToRecord(
      ['№ п/п', 'наименование товара', 'фото с сайта', 'раздел каталога 1-й уровень'],
      ['1', 'Керамический подсвечник', 'MU0001', 'Вазы и аксессуары'],
    )
    expect(resolveSkuFromRow(row)).toBe('MU0001')
  })

  it('finds embedded MU sku in any column', () => {
    expect(resolveSkuFromRow({ misc: 'prefix MU12345 suffix' })).toBe('MU12345')
  })
})

describe('resolveCatalogSubsection', () => {
  it('reads главный раздел каталога 2-й уровень', () => {
    expect(
      resolveCatalogSubsection({ 'главный раздел каталога 2-й уровень': 'Подсвечники' }),
    ).toBe('Подсвечники')
  })

  it('falls back to раздел каталога 2-й уровень', () => {
    expect(resolveCatalogSubsection({ 'раздел каталога 2-й уровень': 'Вазы' })).toBe('Вазы')
  })

  it('prefers главный раздел over fallback key', () => {
    expect(
      resolveCatalogSubsection({
        'главный раздел каталога 2-й уровень': 'Подсвечники',
        'раздел каталога 2-й уровень': 'Вазы',
      }),
    ).toBe('Подсвечники')
  })

  it('returns empty string when column is missing', () => {
    expect(resolveCatalogSubsection({})).toBe('')
  })
})

describe('resolveSheetDiscountPercent', () => {
  it('reads discount from «скидка (%)» column', () => {
    expect(resolveSheetDiscountPercent({ 'скидка (%)': '20' })).toBe(20)
  })

  it('reads discount with comma decimal', () => {
    expect(resolveSheetDiscountPercent({ 'скидка (%)': '15,5' })).toBe(15.5)
  })

  it('returns 0 when column is empty', () => {
    expect(resolveSheetDiscountPercent({})).toBe(0)
  })

  it('returns 0 when value is 0', () => {
    expect(resolveSheetDiscountPercent({ 'скидка (%)': '0' })).toBe(0)
  })

  it('returns 0 when value is 100 or above', () => {
    expect(resolveSheetDiscountPercent({ 'скидка (%)': '100' })).toBe(0)
    expect(resolveSheetDiscountPercent({ 'скидка (%)': '150' })).toBe(0)
  })

  it('falls back to «скидка» column', () => {
    expect(resolveSheetDiscountPercent({ скидка: '10' })).toBe(10)
  })
})
