import { describe, expect, it } from 'vitest'

import {
  columnIndexToA1,
  findHeaderRowIndex,
  normalizeHeaderKey,
  resolveSheetPrice,
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
