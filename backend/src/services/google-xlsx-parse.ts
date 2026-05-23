import * as XLSX from 'xlsx'

import { matrixToCatalogRows, type CatalogReadResult } from './google-catalog-rows'
import { findHeaderRowIndex, isSkuHeader, normalizeHeaderKey } from './google-sheet-headers'

const pickSheetName = (workbook: XLSX.WorkBook, preferredName: string): string | null => {
  const names = workbook.SheetNames ?? []
  if (names.length === 0) return null

  if (preferredName && names.includes(preferredName)) {
    return preferredName
  }

  for (const name of names) {
    const sheet = workbook.Sheets[name]
    if (!sheet) continue
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
    const stringMatrix = matrix.map((row) =>
      Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : [],
    )
    const headerRowIndex = findHeaderRowIndex(stringMatrix)
    const header = stringMatrix[headerRowIndex]?.map((cell) => normalizeHeaderKey(cell)) ?? []
    if (header.some((key) => isSkuHeader(key))) return name
  }

  return names[0] ?? null
}

/** Parse xlsx bytes (used by Drive download and unit tests). */
export const parseXlsxBufferToCatalog = (
  buffer: Buffer,
  preferredSheetName = '',
): CatalogReadResult => {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = pickSheetName(workbook, preferredSheetName.trim())
  if (!sheetName) return { title: '', rows: [] }

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return { title: '', rows: [] }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  const parsed = matrixToCatalogRows(matrix, sheetName)
  return parsed ?? { title: sheetName, rows: [] }
}
