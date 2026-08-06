import * as XLSX from 'xlsx'

import { HttpError } from '../utils/api-response'
import { pool } from '../utils/db'

import { assertCatalogCrmWritable } from './catalog-source.guard'
import {
  createCrmCatalogProduct,
  updateCrmCatalogProduct,
} from './crm-catalog.service'
import {
  PRODUCT_IMPORT_HEADERS,
  PRODUCT_IMPORT_INSTRUCTION_SHEET,
  PRODUCT_IMPORT_REQUIRED_HEADERS,
  PRODUCT_IMPORT_SHEET_NAME,
  SPEC_BRAND,
  SPEC_COLOR,
  SPEC_COUNTRY,
  SPEC_MATERIAL,
  SPEC_SIZE,
} from './crm-catalog-product-import.constants'
import {
  insertCatalogProductImportLog,
  type ProductImportMode,
  type ProductImportRowError,
} from './crm-catalog-product-import-log.service'
import type { StockActor } from './stock-movements.service'

export type ProductImportFieldError = { field: string; message: string }

export type ProductImportRowResult = {
  row: number
  sku: string
  action: 'create' | 'update' | 'error'
  errors: ProductImportFieldError[]
}

export type ProductImportSummary = {
  toCreate: number
  toUpdate: number
  errorRows: number
  total: number
}

export type ProductImportResult = {
  importId?: number
  summary: ProductImportSummary
  rows: ProductImportRowResult[]
}

export type ProductImportActor = {
  adminId: number | null
  adminEmail: string | null
}

type ParsedCellProps = Record<string, string>

type ValidatedRow = {
  row: number
  sku: string
  action: 'create' | 'update'
  productId?: number
  name: string
  price: number
  inStock: number
  discountPercent?: number
  color?: string | null
  size?: string | null
  description?: string
  specs: Record<string, string>
}

/** Normalize RU number strings: "3 500,00" → 3500; strips NBSP/spaces; comma→dot. */
export const parseRuNumber = (raw: string): number | null => {
  const cleaned = raw
    .replace(/\u00A0/g, '')
    .replace(/\s+/g, '')
    .replace(',', '.')
    .trim()
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const cellToString = (value: unknown): string => {
  if (value == null) return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return String(value).trim()
}

const sheetToMatrix = (sheet: XLSX.WorkSheet): unknown[][] => {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })
  return matrix
}

const pickDataSheet = (workbook: XLSX.WorkBook): XLSX.WorkSheet => {
  const byName = workbook.Sheets[PRODUCT_IMPORT_SHEET_NAME]
  if (byName) return byName
  for (const name of workbook.SheetNames) {
    if (name === PRODUCT_IMPORT_INSTRUCTION_SHEET) continue
    const sheet = workbook.Sheets[name]
    if (sheet) return sheet
  }
  throw new HttpError(400, 'В файле нет листа с данными.', 'VALIDATION')
}

const buildHeaderIndex = (headerRow: unknown[]): Map<string, number> => {
  const index = new Map<string, number>()
  headerRow.forEach((cell, i) => {
    const key = cellToString(cell)
    if (key && !index.has(key)) index.set(key, i)
  })
  return index
}

const assertRequiredHeaders = (headerIndex: Map<string, number>): void => {
  const missing = PRODUCT_IMPORT_REQUIRED_HEADERS.filter((h) => !headerIndex.has(h))
  if (missing.length > 0) {
    throw new HttpError(
      400,
      `В файле нет обязательных колонок: ${missing.join(', ')}.`,
      'VALIDATION',
    )
  }
}

const rowToProps = (
  cells: unknown[],
  headerIndex: Map<string, number>,
): ParsedCellProps => {
  const props: ParsedCellProps = {}
  for (const header of PRODUCT_IMPORT_HEADERS) {
    const col = headerIndex.get(header)
    if (col == null) continue
    props[header] = cellToString(cells[col])
  }
  return props
}

const validateRowFields = (
  rowNum: number,
  props: ParsedCellProps,
): { errors: ProductImportFieldError[]; draft?: Omit<ValidatedRow, 'action' | 'productId'> } => {
  const errors: ProductImportFieldError[] = []
  const sku = props['Артикул*']?.trim() ?? ''
  if (!sku) {
    errors.push({ field: 'sku', message: 'Артикул обязателен.' })
  }

  const name = props['Наименование*']?.trim() ?? ''
  if (!name) {
    errors.push({ field: 'name', message: 'Наименование обязательно.' })
  }

  const priceRaw = props['Стоимость, ₽*'] ?? ''
  const price = parseRuNumber(priceRaw)
  if (price == null) {
    errors.push({ field: 'price', message: 'Стоимость обязательна и должна быть числом.' })
  } else if (price < 0) {
    errors.push({ field: 'price', message: 'Стоимость не может быть отрицательной.' })
  }

  const stockRaw = props['Остаток*'] ?? ''
  const stockNum = parseRuNumber(stockRaw)
  let inStock: number | null = null
  if (stockNum == null) {
    errors.push({ field: 'inStock', message: 'Остаток обязателен и должен быть числом.' })
  } else if (stockNum < 0 || !Number.isInteger(stockNum)) {
    errors.push({ field: 'inStock', message: 'Остаток должен быть целым числом ≥ 0.' })
  } else {
    inStock = stockNum
  }

  let discountPercent: number | undefined
  const discountRaw = props['Скидка %']?.trim() ?? ''
  if (discountRaw) {
    const d = parseRuNumber(discountRaw)
    if (d == null || d < 0 || d > 100) {
      errors.push({ field: 'discountPercent', message: 'Скидка % должна быть числом от 0 до 100.' })
    } else {
      discountPercent = d
    }
  }

  if (errors.length > 0 || price == null || inStock == null || !sku || !name) {
    return { errors }
  }

  const color = props['Цвет']?.trim() || null
  const size = props['Размер']?.trim() || null
  const description = props['Описание']?.trim() || undefined
  const brand = props['Бренд']?.trim()
  const material = props['Материал']?.trim()
  const country = props['Страна']?.trim()

  const specs: Record<string, string> = {}
  if (color) specs[SPEC_COLOR] = color
  if (size) specs[SPEC_SIZE] = size
  if (brand) specs[SPEC_BRAND] = brand
  if (material) specs[SPEC_MATERIAL] = material
  if (country) specs[SPEC_COUNTRY] = country

  return {
    errors: [],
    draft: {
      row: rowNum,
      sku: sku.toUpperCase(),
      name,
      price,
      inStock,
      discountPercent,
      color,
      size,
      description,
      specs,
    },
  }
}

const loadExistingBySku = async (
  skus: string[],
): Promise<Map<string, { id: number; specs: Record<string, string> }>> => {
  const map = new Map<string, { id: number; specs: Record<string, string> }>()
  if (skus.length === 0) return map
  const result = await pool.query<{ id: number; sku: string; specs: Record<string, string> | null }>(
    `SELECT id, sku, specs FROM products WHERE sku = ANY($1::text[])`,
    [skus],
  )
  for (const row of result.rows) {
    map.set(row.sku.toUpperCase(), {
      id: row.id,
      specs: (row.specs as Record<string, string>) ?? {},
    })
  }
  return map
}

const buildSummary = (rows: ProductImportRowResult[]): ProductImportSummary => {
  let toCreate = 0
  let toUpdate = 0
  let errorRows = 0
  for (const r of rows) {
    if (r.action === 'create') toCreate += 1
    else if (r.action === 'update') toUpdate += 1
    else errorRows += 1
  }
  return { toCreate, toUpdate, errorRows, total: rows.length }
}

const flattenLogErrors = (rows: ProductImportRowResult[]): ProductImportRowError[] => {
  const out: ProductImportRowError[] = []
  for (const r of rows) {
    if (r.action !== 'error') continue
    for (const e of r.errors) {
      out.push({ row: r.row, sku: r.sku, field: e.field, message: e.message })
    }
    if (r.errors.length === 0) {
      out.push({ row: r.row, sku: r.sku, field: '_', message: 'Ошибка строки.' })
    }
  }
  return out
}

export const parseAndPlanProductImport = async (
  buffer: Buffer,
  mode: ProductImportMode,
): Promise<{ rows: ProductImportRowResult[]; planned: ValidatedRow[] }> => {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const sheet = pickDataSheet(workbook)
  const matrix = sheetToMatrix(sheet)
  if (matrix.length === 0) {
    throw new HttpError(400, 'Файл пуст.', 'VALIDATION')
  }

  const headerIndex = buildHeaderIndex(matrix[0] ?? [])
  assertRequiredHeaders(headerIndex)

  const dataRows = matrix.slice(1).filter((cells) =>
    cells.some((c) => cellToString(c) !== ''),
  )
  if (dataRows.length === 0) {
    throw new HttpError(400, 'В файле нет строк данных.', 'VALIDATION')
  }

  type Interim = {
    rowNum: number
    props: ParsedCellProps
    fieldErrors: ProductImportFieldError[]
    draft?: Omit<ValidatedRow, 'action' | 'productId'>
  }

  const interims: Interim[] = dataRows.map((cells, i) => {
    const rowNum = i + 2 // 1-based Excel row (header is 1)
    const props = rowToProps(cells, headerIndex)
    const { errors, draft } = validateRowFields(rowNum, props)
    return { rowNum, props, fieldErrors: errors, draft }
  })

  // Duplicate SKUs within file → error both rows
  const skuCounts = new Map<string, number>()
  for (const item of interims) {
    const sku = item.draft?.sku ?? item.props['Артикул*']?.trim().toUpperCase() ?? ''
    if (!sku) continue
    skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1)
  }

  const skusForDb = [
    ...new Set(
      interims
        .filter((i) => i.draft && (skuCounts.get(i.draft.sku) ?? 0) === 1)
        .map((i) => i.draft!.sku),
    ),
  ]
  const existing = await loadExistingBySku(skusForDb)

  const rows: ProductImportRowResult[] = []
  const planned: ValidatedRow[] = []

  for (const item of interims) {
    const skuHint =
      item.draft?.sku ?? item.props['Артикул*']?.trim().toUpperCase() ?? ''
    const dupCount = skuHint ? skuCounts.get(skuHint) ?? 0 : 0

    if (dupCount > 1) {
      rows.push({
        row: item.rowNum,
        sku: skuHint,
        action: 'error',
        errors: [
          ...item.fieldErrors,
          { field: 'sku', message: 'Дубликат артикула в файле.' },
        ],
      })
      continue
    }

    if (item.fieldErrors.length > 0 || !item.draft) {
      rows.push({
        row: item.rowNum,
        sku: skuHint,
        action: 'error',
        errors: item.fieldErrors,
      })
      continue
    }

    const found = existing.get(item.draft.sku)
    if (mode === 'new') {
      if (found) {
        rows.push({
          row: item.rowNum,
          sku: item.draft.sku,
          action: 'error',
          errors: [{ field: 'sku', message: 'SKU уже существует.' }],
        })
        continue
      }
      const plannedRow: ValidatedRow = { ...item.draft, action: 'create' }
      planned.push(plannedRow)
      rows.push({ row: item.rowNum, sku: item.draft.sku, action: 'create', errors: [] })
      continue
    }

    // upsert
    if (found) {
      const plannedRow: ValidatedRow = {
        ...item.draft,
        action: 'update',
        productId: found.id,
        specs: { ...found.specs, ...item.draft.specs },
      }
      planned.push(plannedRow)
      rows.push({ row: item.rowNum, sku: item.draft.sku, action: 'update', errors: [] })
    } else {
      const plannedRow: ValidatedRow = { ...item.draft, action: 'create' }
      planned.push(plannedRow)
      rows.push({ row: item.rowNum, sku: item.draft.sku, action: 'create', errors: [] })
    }
  }

  return { rows, planned }
}

export const importCrmCatalogProductsFromBuffer = async (
  buffer: Buffer,
  options: {
    dryRun: boolean
    mode: ProductImportMode
    filename: string
    actor: ProductImportActor
  },
): Promise<ProductImportResult> => {
  assertCatalogCrmWritable()
  const started = Date.now()
  const { rows, planned } = await parseAndPlanProductImport(buffer, options.mode)

  if (options.dryRun) {
    return { summary: buildSummary(rows), rows }
  }

  const stockActor: StockActor =
    options.actor.adminId != null
      ? {
          type: 'admin',
          adminId: options.actor.adminId,
          label: options.actor.adminEmail ?? `admin:${options.actor.adminId}`,
        }
      : { type: 'system' }

  const resultRows: ProductImportRowResult[] = []
  // Preserve error rows from planning; execute planned creates/updates
  const plannedByRow = new Map(planned.map((p) => [p.row, p]))

  for (const preview of rows) {
    if (preview.action === 'error') {
      resultRows.push(preview)
      continue
    }
    const plan = plannedByRow.get(preview.row)
    if (!plan) {
      resultRows.push({
        ...preview,
        action: 'error',
        errors: [{ field: '_', message: 'Внутренняя ошибка планирования строки.' }],
      })
      continue
    }

    try {
      if (plan.action === 'create') {
        await createCrmCatalogProduct({
          sku: plan.sku,
          name: plan.name,
          price: plan.price,
          inStock: plan.inStock,
          discountPercent: plan.discountPercent,
          description: plan.description,
          color: plan.color,
          size: plan.size,
          specs: plan.specs,
        })
        resultRows.push({ row: plan.row, sku: plan.sku, action: 'create', errors: [] })
      } else {
        await updateCrmCatalogProduct(
          plan.productId!,
          {
            name: plan.name,
            price: plan.price,
            inStock: plan.inStock,
            discountPercent: plan.discountPercent ?? 0,
            description: plan.description ?? '',
            color: plan.color,
            size: plan.size,
            specs: plan.specs,
          },
          stockActor,
        )
        resultRows.push({ row: plan.row, sku: plan.sku, action: 'update', errors: [] })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка записи.'
      resultRows.push({
        row: plan.row,
        sku: plan.sku,
        action: 'error',
        errors: [{ field: '_', message }],
      })
    }
  }

  const summary = buildSummary(resultRows)
  const importId = await insertCatalogProductImportLog({
    adminId: options.actor.adminId,
    adminEmail: options.actor.adminEmail,
    filename: options.filename,
    mode: options.mode,
    summary,
    errors: flattenLogErrors(resultRows),
    durationMs: Date.now() - started,
  })

  return { importId, summary, rows: resultRows }
}
