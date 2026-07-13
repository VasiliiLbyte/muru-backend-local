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

export type CrmCatalogListParams = {
  q?: string
  category?: string
  subcategory?: string
  inStock?: 'in' | 'out' | 'all'
  archived?: 'true' | 'false' | 'all'
  page?: number
  pageSize?: number
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
  webSubcategoryName?: string | null
  subcategory?: string | null
  subcategorySlug?: string | null
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
}

export type CrmCatalogProductPatchBody = Partial<Omit<CrmCatalogProductCreateBody, 'sku'>>

export type CrmCategorySubcategoryItem = {
  name: string
  slug: string
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
