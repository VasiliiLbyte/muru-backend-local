import {
  attachWebCatalogCells,
  findHeaderRowIndex,
  isSkuHeader,
  normalizeHeaderKey,
  readWebCatalogCells,
  rowToRecord,
} from './google-sheet-headers'

export type CatalogReadResult = {
  title: string
  rows: Record<string, string>[]
}

const cellToString = (value: unknown): string => {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

export const matrixToCatalogRows = (
  matrix: unknown[][],
  sheetTitle: string,
): CatalogReadResult | null => {
  const rows = matrix.map((row) => (Array.isArray(row) ? row.map(cellToString) : []))
  if (rows.length < 2) return null

  const headerRowIndex = findHeaderRowIndex(rows)
  const header = rows[headerRowIndex].map((cell) => normalizeHeaderKey(cell))
  if (!header.some((key) => isSkuHeader(key))) return null

  const rawHeader = rows[headerRowIndex].map((cell) => String(cell ?? ''))
  const dataRows = rows.slice(headerRowIndex + 1).map((row) => {
    const stringRow = row.map((cell) => String(cell ?? ''))
    const record = rowToRecord(header, stringRow)
    const webCells = readWebCatalogCells(rawHeader, stringRow)
    return attachWebCatalogCells(record, webCells)
  })

  return { title: sheetTitle, rows: dataRows }
}
