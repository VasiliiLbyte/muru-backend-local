import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'

import {
  PRODUCT_IMPORT_HEADERS,
  PRODUCT_IMPORT_SHEET_NAME,
  SPEC_COLOR,
  SPEC_COUNTRY,
  SPEC_SIZE,
} from './crm-catalog-product-import.constants'

const { mockQuery, mockEnv } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockEnv: { catalogSource: 'crm' as 'sheets' | 'crm' },
}))

vi.mock('../utils/env', () => ({
  env: mockEnv,
}))

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}))

vi.mock('./catalog-source.guard', () => ({
  assertCatalogCrmWritable: vi.fn(),
  CatalogLockedError: class CatalogLockedError extends Error {
    constructor() {
      super('locked')
    }
  },
}))

const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockInsertLog = vi.fn()

vi.mock('./crm-catalog.service', () => ({
  createCrmCatalogProduct: (...args: unknown[]) => mockCreate(...args),
  updateCrmCatalogProduct: (...args: unknown[]) => mockUpdate(...args),
}))

vi.mock('./crm-catalog-product-import-log.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./crm-catalog-product-import-log.service')>()
  return {
    ...actual,
    insertCatalogProductImportLog: (...args: unknown[]) => mockInsertLog(...args),
  }
})

import {
  importCrmCatalogProductsFromBuffer,
  parseAndPlanProductImport,
  parseRuNumber,
} from './crm-catalog-product-import.service'

const buildWorkbookBuffer = (rows: string[][]): Buffer => {
  const wb = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([[...PRODUCT_IMPORT_HEADERS], ...rows])
  XLSX.utils.book_append_sheet(wb, sheet, PRODUCT_IMPORT_SHEET_NAME)
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

describe('parseRuNumber', () => {
  it('parses RU price and stock formats', () => {
    expect(parseRuNumber('3 500,00')).toBe(3500)
    expect(parseRuNumber('2,00')).toBe(2)
    expect(parseRuNumber('25')).toBe(25)
    expect(parseRuNumber('25,5')).toBe(25.5)
    expect(parseRuNumber('')).toBeNull()
  })
})

describe('parseAndPlanProductImport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.catalogSource = 'crm'
  })

  it('returns 400 when required column missing', async () => {
    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Артикул*', 'Наименование*', 'Остаток*'],
      ['MU1', 'Name', '1'],
    ])
    XLSX.utils.book_append_sheet(wb, sheet, PRODUCT_IMPORT_SHEET_NAME)
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

    await expect(parseAndPlanProductImport(buffer, 'new')).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('обязательных колонок'),
    })
  })

  it('marks both rows when SKU duplicated in file', async () => {
    const buffer = buildWorkbookBuffer([
      ['MU1', 'A', '100', '1', '', '', '', '', '', '', ''],
      ['MU1', 'B', '200', '2', '', '', '', '', '', '', ''],
    ])
    const { rows } = await parseAndPlanProductImport(buffer, 'new')
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.action === 'error')).toBe(true)
    expect(rows[0].errors.some((e) => e.message.includes('Дубликат'))).toBe(true)
  })

  it('mode=new errors when SKU exists in DB', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 9, sku: 'MU1', specs: {} }],
    })
    const buffer = buildWorkbookBuffer([
      ['MU1', 'A', '100', '1', '', '', '', '', '', '', ''],
    ])
    const { rows } = await parseAndPlanProductImport(buffer, 'new')
    expect(rows[0].action).toBe('error')
    expect(rows[0].errors[0].message).toContain('уже существует')
  })

  it('mode=upsert plans update for existing SKU', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 9, sku: 'MU1', specs: { Бренд: 'Old' } }],
    })
    const buffer = buildWorkbookBuffer([
      ['MU1', 'A', '3 500,00', '2,00', 'белый', 'M', 'desc', 'MURU', 'керамика', 'Россия', '10'],
    ])
    const { rows, planned } = await parseAndPlanProductImport(buffer, 'upsert')
    expect(rows[0].action).toBe('update')
    expect(planned[0].action).toBe('update')
    expect(planned[0].productId).toBe(9)
    expect(planned[0].price).toBe(3500)
    expect(planned[0].inStock).toBe(2)
    expect(planned[0].specs[SPEC_COLOR]).toBe('белый')
    expect(planned[0].specs[SPEC_SIZE]).toBe('M')
    expect(planned[0].specs[SPEC_COUNTRY]).toBe('Россия')
    expect(planned[0].specs['Бренд']).toBe('MURU')
  })

  it('rejects discount outside 0–100', async () => {
    const buffer = buildWorkbookBuffer([
      ['MU1', 'A', '100', '1', '', '', '', '', '', '', '150'],
    ])
    const { rows } = await parseAndPlanProductImport(buffer, 'new')
    expect(rows[0].action).toBe('error')
    expect(rows[0].errors.some((e) => e.field === 'discountPercent')).toBe(true)
  })
})

describe('importCrmCatalogProductsFromBuffer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.catalogSource = 'crm'
    mockCreate.mockResolvedValue({ id: 1 })
    mockUpdate.mockResolvedValue({ id: 9 })
    mockInsertLog.mockResolvedValue(42)
  })

  it('dryRun does not create products or write log', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const buffer = buildWorkbookBuffer([
      ['MU1', 'A', '100', '1', 'red', '', '', '', '', '', ''],
    ])
    const result = await importCrmCatalogProductsFromBuffer(buffer, {
      dryRun: true,
      mode: 'new',
      filename: 't.xlsx',
      actor: { adminId: 1, adminEmail: 'a@b.c' },
    })
    expect(result.summary.toCreate).toBe(1)
    expect(result.importId).toBeUndefined()
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockInsertLog).not.toHaveBeenCalled()
  })

  it('commit creates via write-path with dual-write specs and logs', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const buffer = buildWorkbookBuffer([
      ['MU1', 'A', '100', '1', 'red', 'L', 'd', 'B', 'M', 'Italy', '5'],
    ])
    const result = await importCrmCatalogProductsFromBuffer(buffer, {
      dryRun: false,
      mode: 'new',
      filename: 't.xlsx',
      actor: { adminId: 1, adminEmail: 'a@b.c' },
    })
    expect(result.importId).toBe(42)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        sku: 'MU1',
        color: 'red',
        size: 'L',
        specs: expect.objectContaining({
          [SPEC_COLOR]: 'red',
          [SPEC_SIZE]: 'L',
          [SPEC_COUNTRY]: 'Italy',
        }),
      }),
    )
    expect(mockInsertLog).toHaveBeenCalled()
  })

  it('partial commit skips invalid rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const buffer = buildWorkbookBuffer([
      ['', 'NoSku', '100', '1', '', '', '', '', '', '', ''],
      ['MU2', 'Ok', '200', '3', '', '', '', '', '', '', ''],
    ])
    const result = await importCrmCatalogProductsFromBuffer(buffer, {
      dryRun: false,
      mode: 'new',
      filename: 't.xlsx',
      actor: { adminId: null, adminEmail: null },
    })
    expect(result.summary.errorRows).toBe(1)
    expect(result.summary.toCreate).toBe(1)
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockInsertLog).toHaveBeenCalled()
  })

  it('imports twin names as separate creates without slug errors', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const twinName = 'Керамический салатник'
    const buffer = buildWorkbookBuffer([
      ['MU1001', twinName, '100', '1', '', '', '', '', '', '', ''],
      ['MU1002', twinName, '200', '2', '', '', '', '', '', '', ''],
    ])
    const result = await importCrmCatalogProductsFromBuffer(buffer, {
      dryRun: false,
      mode: 'new',
      filename: 'twins.xlsx',
      actor: { adminId: 1, adminEmail: 'a@b.c' },
    })
    expect(result.summary.toCreate).toBe(2)
    expect(result.summary.errorRows).toBe(0)
    expect(result.rows.every((r) => r.action === 'create')).toBe(true)
    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ sku: 'MU1001', name: twinName }),
    )
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ sku: 'MU1002', name: twinName }),
    )
  })

  it('dryRun and commit produce the same summary for twin names', async () => {
    mockQuery.mockResolvedValue({ rows: [] })
    const twinName = 'Керамический салатник'
    const buffer = buildWorkbookBuffer([
      ['MU1001', twinName, '100', '1', '', '', '', '', '', '', ''],
      ['MU1002', twinName, '200', '2', '', '', '', '', '', '', ''],
    ])

    const preview = await importCrmCatalogProductsFromBuffer(buffer, {
      dryRun: true,
      mode: 'new',
      filename: 'twins.xlsx',
      actor: { adminId: 1, adminEmail: 'a@b.c' },
    })
    const commit = await importCrmCatalogProductsFromBuffer(buffer, {
      dryRun: false,
      mode: 'new',
      filename: 'twins.xlsx',
      actor: { adminId: 1, adminEmail: 'a@b.c' },
    })

    expect(preview.summary).toEqual(commit.summary)
    expect(preview.rows.map((r) => ({ row: r.row, action: r.action, sku: r.sku }))).toEqual(
      commit.rows.map((r) => ({ row: r.row, action: r.action, sku: r.sku })),
    )
  })

  it('upsert update path does not pass slug in patch', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 9, sku: 'MU1', specs: {} }],
    })
    const buffer = buildWorkbookBuffer([
      ['MU1', 'Updated name', '100', '1', '', '', '', '', '', '', ''],
    ])
    await importCrmCatalogProductsFromBuffer(buffer, {
      dryRun: false,
      mode: 'upsert',
      filename: 't.xlsx',
      actor: { adminId: 1, adminEmail: 'a@b.c' },
    })
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    const patch = mockUpdate.mock.calls[0][1] as Record<string, unknown>
    expect(patch).not.toHaveProperty('slug')
  })
})
