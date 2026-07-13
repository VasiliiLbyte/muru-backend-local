import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'

import { parseXlsxBufferToCatalog } from './google-xlsx-parse'
import { buildFixtureBuffer } from './test-helpers/catalog-xlsx-fixture'

describe('parseXlsxBufferToCatalog', () => {
  it('parses header on second row and maps shifted SKU in фото с сайта', () => {
    const buffer = buildFixtureBuffer()
    const result = parseXlsxBufferToCatalog(buffer)

    expect(result.title).toBe('Реестр')
    expect(result.rows.length).toBe(2)

    const withSku = result.rows.find((row) => row['фото с сайта'] === 'MU0099')
    expect(withSku).toBeDefined()
    expect(withSku?.['наименование товара']).toBe('Товар тест')
    expect(withSku?.['раздел каталога 1-й уровень']).toBe('Вазы и аксессуары')
    expect(withSku?.['фактический остаток']).toBe('3')
  })

  it('selects sheet by preferred name', () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([['артикул товара для сайта'], ['MU0001']]),
      'Другой',
    )
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['артикул товара для сайта', 'наименование товара'],
        ['MU0002', 'Имя'],
      ]),
      'Каталог',
    )
    const buffer = Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
    const result = parseXlsxBufferToCatalog(buffer, 'Каталог')
    expect(result.title).toBe('Каталог')
    expect(result.rows[0]?.['артикул товара для сайта']).toBe('MU0002')
  })
})
