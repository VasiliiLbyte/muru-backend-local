import { slugify } from './crm-catalog.helpers'

export const CATEGORY_ALIASES: Record<string, string> = {
  'Флористика для дома': 'Флористика',
}

export const BOKALY_SUBCATEGORY_NAME = 'Бокалы'
export const KITCHEN_CATEGORY_NAME = 'Кухня и столовая'
export const NEW_ARRIVALS_COLLECTION = 'Новинки'

export type ImportParity38RawRow = {
  sku: string
  name: string
  price: string
  stock: string
  discount_percent: string
  category: string
  subcategory: string
  color: string
  size: string
  collection: string
}

export type ImportParity38ProductInput = {
  sku: string
  name: string
  price: number
  inStock: number
  discountPercent: number
  sheetCategory: string
  resolvedCategoryName: string
  subcategory: string
  color: string | null
  size: string | null
  dimensionsLabel: string
  collection: string
  isNewArrival: boolean
  slug: string
}

export const resolveCategoryName = (sheetCategory: string): string => {
  const trimmed = sheetCategory.trim()
  return CATEGORY_ALIASES[trimmed] ?? trimmed
}

export const isNewArrivalFromCollection = (collection: string | null | undefined): boolean =>
  (collection ?? '').trim() === NEW_ARRIVALS_COLLECTION

export const buildProductSlug = (sku: string, name: string): string =>
  `${sku.trim().toLowerCase()}-${slugify(name)}`

const toNonNegInt = (value: string, field: string): number => {
  const n = Number(String(value).trim().replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Некорректное значение ${field}: ${value}`)
  }
  return Math.floor(n)
}

const toNonNegNumber = (value: string, field: string): number => {
  const n = Number(String(value).trim().replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Некорректное значение ${field}: ${value}`)
  }
  return n
}

/** Returns null for STUB / incomplete rows (no name or price). */
export const parseImportRow = (
  raw: ImportParity38RawRow,
): ImportParity38ProductInput | null => {
  const sku = raw.sku.trim().toUpperCase()
  const name = raw.name.trim()
  const priceRaw = raw.price.trim()
  if (!sku || !name || !priceRaw) return null

  const size = raw.size.trim() || null
  const color = raw.color.trim() || null
  const collection = raw.collection.trim()
  const sheetCategory = raw.category.trim()
  const subcategory = raw.subcategory.trim()

  if (!sheetCategory || !subcategory) {
    throw new Error(`${sku}: пустые category/subcategory`)
  }

  return {
    sku,
    name,
    price: toNonNegNumber(priceRaw, 'price'),
    inStock: toNonNegInt(raw.stock || '0', 'stock'),
    discountPercent: toNonNegNumber(raw.discount_percent || '0', 'discount_percent'),
    sheetCategory,
    resolvedCategoryName: resolveCategoryName(sheetCategory),
    subcategory,
    color,
    size,
    dimensionsLabel: size ?? '',
    collection,
    isNewArrival: isNewArrivalFromCollection(collection),
    slug: buildProductSlug(sku, name),
  }
}

/** Minimal RFC4180-ish CSV line parser (handles quotes and doubled quotes). */
export const parseCsvLine = (line: string): string[] => {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

export const parseImportCsv = (text: string): ImportParity38RawRow[] => {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return []

  const headers = parseCsvLine(lines[0]).map((h) => h.trim())
  const required = [
    'sku',
    'name',
    'price',
    'stock',
    'discount_percent',
    'category',
    'subcategory',
    'color',
    'size',
    'collection',
  ]
  for (const key of required) {
    if (!headers.includes(key)) {
      throw new Error(`CSV: отсутствует колонка ${key}`)
    }
  }

  const rows: ImportParity38RawRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const obj: Record<string, string> = {}
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = cols[c] ?? ''
    }
    rows.push(obj as ImportParity38RawRow)
  }
  return rows
}
