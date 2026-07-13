import * as XLSX from 'xlsx'

import { pool } from '../utils/db'
import { env } from '../utils/env'

import { buildExportMatrix, type ExportCatalogRow } from './crm-catalog-sheet-map'

export type CatalogExportFormat = 'xlsx' | 'csv'

type ExportDbRow = {
  sku: string
  name: string
  description: string | null
  price: string | number
  discount_percent: string | number
  in_stock: number
  color: string | null
  dimensions_label: string | null
  specs: Record<string, string> | null
  is_archived: boolean
  category_name: string | null
  web_subcategory_name: string | null
  cross_category_name: string | null
  cross_subcategory_name: string | null
  variants_str: string
}

const EXPORT_QUERY = `
  SELECT p.sku,
         p.name,
         p.description,
         p.price,
         p.discount_percent,
         p.in_stock,
         p.color,
         p.dimensions_label,
         p.specs,
         p.is_archived,
         c.name AS category_name,
         p.web_subcategory_name,
         c_cross.name AS cross_category_name,
         pwcp.subcategory_name AS cross_subcategory_name,
         COALESCE(variants_agg.variants_str, '') AS variants_str
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN product_web_cross_placements pwcp ON pwcp.product_id = p.id
  LEFT JOIN categories c_cross ON c_cross.id = pwcp.category_id
  LEFT JOIN LATERAL (
    SELECT string_agg(
      trim(both '|' from concat_ws('|', NULLIF(v.color, ''), NULLIF(v.size, ''))),
      ';' ORDER BY v.id
    ) AS variants_str
    FROM variants v
    WHERE v.product_id = p.id
  ) variants_agg ON true
  ORDER BY p.sku
`

const mapDbRow = (row: ExportDbRow): ExportCatalogRow => ({
  sku: row.sku,
  name: row.name,
  categoryName: row.category_name,
  webSubcategoryName: row.web_subcategory_name,
  crossCategoryName: row.cross_category_name,
  crossSubcategoryName: row.cross_subcategory_name,
  price: Number(row.price),
  discountPercent: Number(row.discount_percent),
  inStock: row.in_stock,
  description: row.description ?? '',
  color: row.color,
  dimensionsLabel: row.dimensions_label ?? '',
  variantsStr: row.variants_str,
  specs: (row.specs as Record<string, string>) ?? {},
  isArchived: row.is_archived,
})

const escapeCsvCell = (value: string): string => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

const buildCsvBuffer = (matrix: string[][]): Buffer => {
  const lines = matrix.map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
  const content = `\uFEFF${lines.join('\n')}`
  return Buffer.from(content, 'utf8')
}

const buildXlsxBuffer = (matrix: string[][]): Buffer => {
  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  const workbook = XLSX.utils.book_new()
  const sheetName = env.googleCatalogXlsxSheetName || 'Реестр'
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
}

const buildFilename = (format: CatalogExportFormat): string => {
  const date = new Date().toISOString().slice(0, 10)
  return `muru-catalog-${date}.${format}`
}

export const exportCrmCatalog = async (
  format: CatalogExportFormat,
): Promise<{ buffer: Buffer; contentType: string; filename: string }> => {
  const result = await pool.query<ExportDbRow>(EXPORT_QUERY)
  const rows = result.rows.map(mapDbRow)
  const matrix = buildExportMatrix(rows)

  if (format === 'csv') {
    return {
      buffer: buildCsvBuffer(matrix),
      contentType: 'text/csv; charset=utf-8',
      filename: buildFilename('csv'),
    }
  }

  return {
    buffer: buildXlsxBuffer(matrix),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: buildFilename('xlsx'),
  }
}
