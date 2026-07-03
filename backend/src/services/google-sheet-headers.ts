/** Shared Google Sheets header detection and row mapping (sync + stock write). */

export const SHEET_VALUE_RANGE = 'A1:AZ'

export const SHEET_SCAN_LIMIT = 10

const SKU_HEADER_ALIASES = [
  'sku',
  'артикул',
  'артикул товара',
  'артикул товара для сайта',
  'sku/артикул',
  'артикул/sku',
  'код товара',
]

/** Matches MU0001-style site SKUs in a cell value. */
export const MU_SKU_CELL_PATTERN = /^MU\d{4,}\b/i

const extractMuSku = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const exact = trimmed.match(/^MU\d{4,}\b/i)
  if (exact) return exact[0].toUpperCase()
  const embedded = trimmed.match(/MU\d{4,}\b/i)
  return embedded ? embedded[0].toUpperCase() : ''
}

export const normalizeHeaderKey = (value: string) =>
  value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

export const isSkuHeader = (key: string) =>
  SKU_HEADER_ALIASES.includes(key) || key.includes('артикул') || key.includes('sku')

export const isStockHeader = (key: string) =>
  key === 'stock' || key === 'наличие' || key === 'фактический остаток' || key.includes('остаток')

export const findHeaderRowIndex = (rows: string[][]): number => {
  const scanLimit = Math.min(rows.length, SHEET_SCAN_LIMIT)
  for (let i = 0; i < scanLimit; i += 1) {
    const normalizedRow = rows[i].map((cell) => normalizeHeaderKey(String(cell ?? '')))
    if (normalizedRow.some((key) => isSkuHeader(key))) {
      return i
    }
  }
  return 0
}

/**
 * Map a data row to header keys. Duplicate header names keep the first column value
 * (new sheet has two "раздел каталога 1-й уровень" columns).
 */
export const rowToRecord = (header: string[], row: string[]): Record<string, string> => {
  const record: Record<string, string> = {}
  header.forEach((key, index) => {
    if (!key) return
    const value = String(row[index] ?? '').trim()
    if (!(key in record)) {
      record[key] = value
      return
    }
    if (!record[key] && value) {
      record[key] = value
    }
  })
  return record
}

/** Zero-based column index to A1 letter(s), e.g. 0 -> A, 26 -> AA */
export const columnIndexToA1 = (zeroBased: number): string => {
  let n = zeroBased
  let result = ''
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result
    n = Math.floor(n / 26) - 1
  }
  return result
}

export const resolveSheetPrice = (source: Record<string, string>) =>
  source.price ??
  source['цена'] ??
  source['розничная цена'] ??
  source['стоимость (без ндс) (руб.)'] ??
  source['стоимость'] ??
  ''

export const resolveSheetDiscountPercent = (source: Record<string, string>): number => {
  const raw = source['скидка (%)'] ?? source['скидка'] ?? source['discount'] ?? ''
  const parsed = parseFloat(String(raw).replace(',', '.').replace(/[^\d.]/g, ''))
  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 100) return 0
  return parsed
}

export const TOP_LEVEL_CATALOG_HEADER = 'раздел каталога 1-й уровень'

export const WEB_PRIMARY_TOP_KEY = '__webPrimaryTop'
export const WEB_PRIMARY_SUB_KEY = '__webPrimarySub'
export const WEB_CROSS_TOP_KEY = '__webCrossTop'
export const WEB_CROSS_SUB_KEY = '__webCrossSub'

export type WebCatalogCells = {
  primaryTop: string
  primarySub: string
  crossTop: string
  crossSub: string
}

export const resolveWebCatalogColumnIndices = (
  header: string[],
): { primaryTop: number; primarySub: number; crossTop: number | null; crossSub: number | null } | null => {
  const topLevelKey = normalizeHeaderKey(TOP_LEVEL_CATALOG_HEADER)
  const topIndices: number[] = []
  header.forEach((cell, index) => {
    if (normalizeHeaderKey(cell) === topLevelKey) topIndices.push(index)
  })
  if (topIndices.length === 0) return null

  const primaryTop = topIndices[0]
  const primarySub = primaryTop + 1
  const crossTop = topIndices.length > 1 ? topIndices[1] : null
  const crossSub = crossTop != null ? crossTop + 1 : null
  return { primaryTop, primarySub, crossTop, crossSub }
}

const cellAt = (row: string[], index: number | null | undefined): string => {
  if (index == null || index < 0 || index >= row.length) return ''
  return String(row[index] ?? '').trim()
}

export const readWebCatalogCells = (header: string[], row: string[]): WebCatalogCells => {
  const indices = resolveWebCatalogColumnIndices(header)
  if (!indices) {
    return { primaryTop: '', primarySub: '', crossTop: '', crossSub: '' }
  }
  return {
    primaryTop: cellAt(row, indices.primaryTop),
    primarySub: cellAt(row, indices.primarySub),
    crossTop: cellAt(row, indices.crossTop),
    crossSub: cellAt(row, indices.crossSub),
  }
}

export const attachWebCatalogCells = (
  record: Record<string, string>,
  cells: WebCatalogCells,
): Record<string, string> => ({
  ...record,
  [WEB_PRIMARY_TOP_KEY]: cells.primaryTop,
  [WEB_PRIMARY_SUB_KEY]: cells.primarySub,
  [WEB_CROSS_TOP_KEY]: cells.crossTop,
  [WEB_CROSS_SUB_KEY]: cells.crossSub,
})

export const resolvePrimaryCatalogSection = (source: Record<string, string>) =>
  source[WEB_PRIMARY_TOP_KEY]?.trim() ||
  source['раздел каталога 1-й уровень'] ||
  source.section ||
  source['раздел'] ||
  source.categories ||
  source['категории'] ||
  ''

export const resolveCatalogSubsection = (source: Record<string, string>) =>
  source['главный раздел каталога 2-й уровень'] ??
  source['раздел каталога 2-й уровень'] ??
  ''

/**
 * Resolves site SKU from a row record (handles shifted columns in client xlsx).
 */
export const resolveSkuFromRow = (source: Record<string, string>): string => {
  for (const alias of SKU_HEADER_ALIASES) {
    const fromAlias = extractMuSku(source[alias] ?? '')
    if (fromAlias) return fromAlias
  }

  for (const [key, raw] of Object.entries(source)) {
    if (!isSkuHeader(normalizeHeaderKey(key))) continue
    const fromHeader = extractMuSku(raw ?? '')
    if (fromHeader) return fromHeader
  }

  const fromPhotoColumn = extractMuSku(source['фото с сайта'] ?? '')
  if (fromPhotoColumn) return fromPhotoColumn

  for (const raw of Object.values(source)) {
    const found = extractMuSku(raw ?? '')
    if (found) return found
  }

  return ''
}
