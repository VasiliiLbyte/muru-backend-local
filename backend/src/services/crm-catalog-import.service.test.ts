import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: { catalogSource: 'sheets' as 'sheets' | 'crm' },
}))

vi.mock('../utils/env', () => ({
  env: mockEnv,
}))

vi.mock('./google-xlsx-parse', () => ({
  parseXlsxBufferToCatalog: vi.fn(),
}))

vi.mock('./google-sync', () => ({
  importCatalogProductsFromRows: vi.fn(),
}))

import { CatalogLockedError } from './catalog-source.guard'
import { importCrmCatalogFromBuffer } from './crm-catalog-import.service'
import { importCatalogProductsFromRows } from './google-sync'
import { parseXlsxBufferToCatalog } from './google-xlsx-parse'

const mockParse = vi.mocked(parseXlsxBufferToCatalog)
const mockImportRows = vi.mocked(importCatalogProductsFromRows)

describe('crm-catalog-import.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.catalogSource = 'crm'
    mockParse.mockReturnValue({ title: 'Реестр', rows: [] })
    mockImportRows.mockResolvedValue({
      dryRun: true,
      totalRows: 0,
      parsed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    })
  })

  it('throws CatalogLockedError in sheets mode', async () => {
    mockEnv.catalogSource = 'sheets'
    await expect(importCrmCatalogFromBuffer(Buffer.from('x'), true)).rejects.toBeInstanceOf(
      CatalogLockedError,
    )
  })

  it('throws when parse returns no rows', async () => {
    await expect(importCrmCatalogFromBuffer(Buffer.from('x'), true)).rejects.toMatchObject({
      status: 400,
      message: 'No catalog rows or missing SKU header',
    })
  })

  it('delegates to importCatalogProductsFromRows', async () => {
    mockParse.mockReturnValue({
      title: 'Реестр',
      rows: [{ 'артикул товара для сайта': 'MU0001', 'наименование товара': 'Item' }],
    })
    mockImportRows.mockResolvedValue({
      dryRun: true,
      totalRows: 1,
      parsed: 1,
      created: 1,
      updated: 0,
      skipped: 0,
      errors: [],
    })

    const result = await importCrmCatalogFromBuffer(Buffer.from('x'), true)
    expect(result.created).toBe(1)
    expect(mockImportRows).toHaveBeenCalledWith(
      [{ 'артикул товара для сайта': 'MU0001', 'наименование товара': 'Item' }],
      { dryRun: true },
    )
  })
})
