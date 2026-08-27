import type { CrmCatalogSortBy, CrmCatalogSortDir } from '../types/catalog'

export type ProductsListArchivedFilter = 'false' | 'true' | 'all'
export type ProductsListStockFilter = 'all' | 'in' | 'out'
export type ProductsListTriFilter = 'all' | 'true' | 'false'

export type ProductsListSearchState = {
  q: string
  category: string
  subcategory: string
  inStock: ProductsListStockFilter
  archived: ProductsListArchivedFilter
  giftGuide: ProductsListTriFilter
  newArrival: ProductsListTriFilter
  collectionId: string
  page: number
  sortBy: CrmCatalogSortBy
  sortDir: CrmCatalogSortDir
}

export const PRODUCTS_LIST_SEARCH_DEFAULTS: ProductsListSearchState = {
  q: '',
  category: '',
  subcategory: '',
  inStock: 'all',
  archived: 'false',
  giftGuide: 'all',
  newArrival: 'all',
  collectionId: '',
  page: 1,
  sortBy: 'updatedAt',
  sortDir: 'desc',
}

const SORT_BY_VALUES: ReadonlySet<string> = new Set([
  'sku',
  'price',
  'inStock',
  'updatedAt',
  'newArrivalAt',
])

const STOCK_VALUES: ReadonlySet<string> = new Set(['all', 'in', 'out'])
const ARCHIVED_VALUES: ReadonlySet<string> = new Set(['false', 'true', 'all'])
const TRI_VALUES: ReadonlySet<string> = new Set(['all', 'true', 'false'])
const SORT_DIR_VALUES: ReadonlySet<string> = new Set(['asc', 'desc'])

const parseEnum = <T extends string>(
  raw: string | null,
  allowed: ReadonlySet<string>,
  fallback: T,
): T => {
  if (raw && allowed.has(raw)) return raw as T
  return fallback
}

export const parseProductsListSearch = (params: URLSearchParams): ProductsListSearchState => {
  const pageRaw = Number(params.get('page') ?? '')
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : PRODUCTS_LIST_SEARCH_DEFAULTS.page

  return {
    q: (params.get('q') ?? '').trim(),
    category: params.get('category') ?? '',
    subcategory: params.get('subcategory') ?? '',
    inStock: parseEnum(params.get('inStock'), STOCK_VALUES, PRODUCTS_LIST_SEARCH_DEFAULTS.inStock),
    archived: parseEnum(
      params.get('archived'),
      ARCHIVED_VALUES,
      PRODUCTS_LIST_SEARCH_DEFAULTS.archived,
    ),
    giftGuide: parseEnum(
      params.get('giftGuide'),
      TRI_VALUES,
      PRODUCTS_LIST_SEARCH_DEFAULTS.giftGuide,
    ),
    newArrival: parseEnum(
      params.get('newArrival'),
      TRI_VALUES,
      PRODUCTS_LIST_SEARCH_DEFAULTS.newArrival,
    ),
    collectionId: params.get('collectionId') ?? '',
    page,
    sortBy: parseEnum(params.get('sortBy'), SORT_BY_VALUES, PRODUCTS_LIST_SEARCH_DEFAULTS.sortBy),
    sortDir: parseEnum(
      params.get('sortDir'),
      SORT_DIR_VALUES,
      PRODUCTS_LIST_SEARCH_DEFAULTS.sortDir,
    ),
  }
}

export const buildProductsListSearch = (state: ProductsListSearchState): URLSearchParams => {
  const params = new URLSearchParams()
  const d = PRODUCTS_LIST_SEARCH_DEFAULTS

  if (state.q !== d.q) params.set('q', state.q)
  if (state.category !== d.category) params.set('category', state.category)
  if (state.subcategory !== d.subcategory) params.set('subcategory', state.subcategory)
  if (state.inStock !== d.inStock) params.set('inStock', state.inStock)
  if (state.archived !== d.archived) params.set('archived', state.archived)
  if (state.giftGuide !== d.giftGuide) params.set('giftGuide', state.giftGuide)
  if (state.newArrival !== d.newArrival) params.set('newArrival', state.newArrival)
  if (state.collectionId !== d.collectionId) params.set('collectionId', state.collectionId)
  if (state.page !== d.page) params.set('page', String(state.page))
  if (state.sortBy !== d.sortBy) {
    params.set('sortBy', state.sortBy)
    // Always pair non-default sortBy with sortDir so F5 keeps direction.
    params.set('sortDir', state.sortDir)
  } else if (state.sortDir !== d.sortDir) {
    params.set('sortDir', state.sortDir)
  }

  return params
}
