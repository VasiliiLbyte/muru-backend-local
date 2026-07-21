export type CrmCatalogMeta = {
  catalogSource: 'sheets' | 'crm'
  readOnly: boolean
}

export type CrmCatalogListItem = {
  id: number
  sku: string
  name: string
  price: number
  discountPercent: number
  inStock: number
  isArchived: boolean
  isGiftGuide: boolean
  isNewArrival: boolean
  newArrivalAt: string | null
  categoryName: string | null
  webSubcategoryName: string | null
  imageUrl: string | null
}

export type CrmCatalogProductDetail = {
  id: number
  sku: string
  name: string
  description: string
  price: number
  discountPercent: number
  inStock: number
  isArchived: boolean
  isGiftGuide: boolean
  isNewArrival: boolean
  newArrivalAt: string | null
  specs: Record<string, string>
  imageUrls: string[]
  imageUrl1: string
  imageUrl2: string
  categoryId: number | null
  categoryName: string | null
  webSubcategoryName: string | null
  webSubcategorySlug: string | null
  subcategory: string | null
  subcategorySlug: string | null
  subcategoryIds: number[]
  color: string | null
  size: string | null
  colorTags: string[]
  dimensionsLabel: string
  weightGrams: number
  dimLengthCm: number
  dimWidthCm: number
  dimHeightCm: number
  dimsSource: 'auto' | 'manual'
  weightSource: 'auto' | 'manual'
  updatedAt: string
}

export type CrmCatalogSortBy = 'sku' | 'price' | 'inStock' | 'updatedAt' | 'newArrivalAt'
export type CrmCatalogSortDir = 'asc' | 'desc'

export type CrmCatalogListParams = {
  q?: string
  category?: string
  subcategory?: string
  collectionId?: number
  inStock?: 'in' | 'out' | 'all'
  archived?: 'true' | 'false' | 'all'
  giftGuide?: 'true' | 'false' | 'all'
  newArrival?: 'true' | 'false' | 'all'
  page?: number
  pageSize?: number
  sortBy?: CrmCatalogSortBy
  sortDir?: CrmCatalogSortDir
}

export type CrmCatalogListResult = {
  items: CrmCatalogListItem[]
  total: number
  page: number
  pageSize: number
  catalogSource: 'sheets' | 'crm'
  readOnly: boolean
}

export type CrmCatalogProductCreateBody = {
  sku: string
  name: string
  price: number
  description?: string
  discountPercent?: number
  inStock?: number
  categoryId?: number | null
  subcategoryIds?: number[]
  color?: string | null
  size?: string | null
  colorTags?: string[]
  dimensionsLabel?: string
  specs?: Record<string, string>
  imageUrls?: string[]
  imageUrl1?: string
  imageUrl2?: string
  weightGrams?: number
  dimLengthCm?: number
  dimWidthCm?: number
  dimHeightCm?: number
  isGiftGuide?: boolean
  isNewArrival?: boolean
}

export type CrmCatalogProductPatchBody = Partial<Omit<CrmCatalogProductCreateBody, 'sku'>>

export type CrmCategorySubcategoryItem = {
  id: number
  name: string
  slug: string
  coverImageUrl: string | null
  sortOrder: number
  productCount: number
}

export type CrmCategoryItem = {
  id: number
  name: string
  slug: string
  coverImageUrl: string | null
  coverDriveFilename: string | null
  productCount: number
  directProductCount: number
  subcategories: CrmCategorySubcategoryItem[]
  crossPlacementCount: number
  isUnused: boolean
}

export type CrmCharacteristicItem = {
  id: number
  name: string
  sortOrder: number
}

export type CrmCatalogImageUpload = {
  url: string
  fileId: string
  proxyPath: string
}

export type CrmCatalogImportResult = {
  dryRun: boolean
  totalRows: number
  parsed: number
  created: number
  updated: number
  skipped: number
  errors: Array<{ row: number; sku?: string; message: string }>
}

export type CrmCategoryCreateBody = { name: string }

export type CrmCategoryPatchBody = {
  name?: string
  slug?: string
  coverImageUrl?: string | null
}

export type CrmSubcategoryCreateBody = {
  name: string
  coverImageUrl?: string | null
}

export type CrmSubcategoryPatchBody = {
  name?: string
  slug?: string
  coverImageUrl?: string | null
  sortOrder?: number
}

export type CrmSubcategoryItem = {
  id: number
  categoryId: number
  name: string
  slug: string
  coverImageUrl: string | null
  sortOrder: number
  productCount: number
}

export type CrmRenameSubcategoryBody = {
  categoryId: number
  oldSubcategoryName: string
  newSubcategoryName: string
}

export type CrmCharacteristicCreateBody = {
  name: string
  sortOrder?: number
}

export type CrmCharacteristicPatchBody = {
  name?: string
  sortOrder?: number
}

export type ProductImageSlot = {
  url: string
  proxyPath?: string
}
