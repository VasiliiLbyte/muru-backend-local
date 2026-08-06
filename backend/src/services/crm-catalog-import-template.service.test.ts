import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'

import {
  PRODUCT_IMPORT_HEADERS,
  PRODUCT_IMPORT_SHEET_NAME,
} from './crm-catalog-product-import.constants'
import { getCrmCatalogProductImportTemplate } from './crm-catalog-import-template.service'

describe('crm-catalog-import-template.service', () => {
  it('builds xlsx with 11 headers and instruction sheet', () => {
    const { buffer, filename, contentType } = getCrmCatalogProductImportTemplate()
    expect(filename).toBe('muru-product-import-template.xlsx')
    expect(contentType).toContain('spreadsheetml')

    const wb = XLSX.read(buffer, { type: 'buffer' })
    expect(wb.SheetNames).toContain(PRODUCT_IMPORT_SHEET_NAME)
    expect(wb.SheetNames).toContain('Инструкция')

    const sheet = wb.Sheets[PRODUCT_IMPORT_SHEET_NAME]
    const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })
    expect(matrix[0]).toEqual([...PRODUCT_IMPORT_HEADERS])
    expect(PRODUCT_IMPORT_HEADERS).toHaveLength(11)
    expect(matrix.length).toBeGreaterThanOrEqual(2)
  })
})
