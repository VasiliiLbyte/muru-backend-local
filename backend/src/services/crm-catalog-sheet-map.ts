import { TOP_LEVEL_CATALOG_HEADER } from './google-sheet-headers'

/**
 * Sheet key (normalized lowercase) → display name in products.specs JSONB.
 * Shared by import (google-sync normalizeProduct) and export column mapping.
 */
export const CATALOG_SPEC_MAPPING: Record<string, string> = {
  бренд: 'Бренд',
  материал: 'Материал',
  'плотность ткани': 'Плотность ткани',
  дизайн: 'Дизайн',
  тип: 'Тип',
  'размер наволочки': 'Размер наволочки',
  'размер пододеяльника': 'Размер пододеяльника',
  'размер простыни': 'Размер простыни',
  'страна производитель': 'Страна',
  ингредиенты: 'Ингредиенты',
  происхождение: 'Происхождение',
  упаковка: 'Упаковка',
}

/** Human-readable spec column headers for export (sheet keys from CATALOG_SPEC_MAPPING). */
export const CATALOG_SPEC_HEADERS = Object.keys(CATALOG_SPEC_MAPPING)

/**
 * Ordered export column headers for customer XLSX/CSV round-trip.
 * Positional subcategory columns follow each "раздел каталога 1-й уровень" (readWebCatalogCells).
 * is_archived uses TRUE/FALSE strings for Excel compatibility.
 */
export const CATALOG_EXPORT_HEADERS: string[] = [
  'Артикул товара для сайта',
  'Наименование товара',
  TOP_LEVEL_CATALOG_HEADER,
  '', // primary subcategory (positional)
  TOP_LEVEL_CATALOG_HEADER,
  '', // cross subcategory (positional)
  'стоимость (без НДС) (руб.)',
  'скидка (%)',
  'Фактический остаток',
  'подробная информация (описание)',
  'цвет',
  'размер',
  'варианты',
  ...CATALOG_SPEC_HEADERS,
  'is_archived',
]

export type ExportCatalogRow = {
  sku: string
  name: string
  categoryName: string | null
  webSubcategoryName: string | null
  crossCategoryName: string | null
  crossSubcategoryName: string | null
  price: number
  discountPercent: number
  inStock: number
  description: string
  color: string | null
  dimensionsLabel: string
  variantsStr: string
  specs: Record<string, string>
  isArchived: boolean
}

const formatPrice = (price: number): string => {
  if (!Number.isFinite(price)) return '0'
  return String(price).replace('.', ',')
}

const formatArchived = (isArchived: boolean): string => (isArchived ? 'TRUE' : 'FALSE')

export const exportRowToSheetCells = (row: ExportCatalogRow): string[] => {
  const cells: string[] = [
    row.sku,
    row.name,
    row.categoryName ?? '',
    row.webSubcategoryName ?? '',
    row.crossCategoryName ?? '',
    row.crossSubcategoryName ?? '',
    formatPrice(row.price),
    String(row.discountPercent),
    String(row.inStock),
    row.description ?? '',
    row.color ?? '',
    row.dimensionsLabel ?? '',
    row.variantsStr ?? '',
  ]

  for (const sheetKey of CATALOG_SPEC_HEADERS) {
    const displayName = CATALOG_SPEC_MAPPING[sheetKey]
    cells.push(row.specs[displayName] ?? '')
  }

  cells.push(formatArchived(row.isArchived))
  return cells
}

export const buildExportMatrix = (rows: ExportCatalogRow[]): string[][] => [
  CATALOG_EXPORT_HEADERS,
  ...rows.map(exportRowToSheetCells),
]

/** Test helper: map parsed sheet row keys back to export shape fields. */
export const sheetRowToExportShape = (
  row: Record<string, string>,
): Pick<
  ExportCatalogRow,
  'sku' | 'name' | 'categoryName' | 'webSubcategoryName' | 'inStock'
> => ({
  sku: row['артикул товара для сайта'] ?? row['фото с сайта'] ?? '',
  name: row['наименование товара'] ?? '',
  categoryName: row['раздел каталога 1-й уровень'] ?? row.__webPrimaryTop ?? '',
  webSubcategoryName: row.__webPrimarySub ?? '',
  inStock: Number(row['фактический остаток'] ?? 0),
})
