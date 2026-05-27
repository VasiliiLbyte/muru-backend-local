export type Category = {
  id?: number
  name: string
  slug: string
}

export type Variant = {
  color?: string
  size?: string
}

export type Product = {
  sku: string
  name: string
  categoryNames: string[]
  price: number
  inStock: number
  description: string
  specs: Record<string, string>
  variants: Variant[]
  imageUrls: string[]
  color?: string
  colorTags?: string[]
  size?: string
  dimensionsLabel?: string
  parsedDims?: { lengthCm: number; widthCm: number; heightCm: number } | null
  weightGramsEstimated?: number | null
}

export type SyncError = {
  sku: string
  reason: string
}

export type SyncErrorGroup = {
  reason: string
  count: number
  sampleSkus: string[]
}

export type CatalogSyncProgress = {
  phase: 'sheet' | 'drive' | 'database' | 'done'
  message: string
  foldersScanned?: number
  imagesSeen?: number
  processedProducts?: number
  totalProducts?: number
}

export type SyncResult = {
  totalRows: number
  syncedProducts: number
  skippedProducts: number
  skippedByRule: number
  errors: SyncError[]
  /** Non-fatal issues, e.g. missing Drive placeholder file */
  warnings?: string[]
  errorGroups?: SyncErrorGroup[]
  durationMs?: number
  sheetTitle?: string
  driveFoldersScanned?: number
  driveImagesSeen?: number
  driveImagesMatched?: number
  driveSkusWithImages?: number
}

export type CatalogNode = {
  name: string
  slug: string
  children: CatalogNode[]
  /** Public thumbnail URL after category cover sync; merged by slug */
  coverImageUrl?: string | null
}

export type AdminCategoryRow = {
  id: number
  name: string
  slug: string
  coverDriveFilename: string | null
  coverImageUrl: string | null
}

export type CategoryCoverSyncError = {
  categoryId: number
  slug: string
  reason: string
}

export type CategoryCoverSyncResult = {
  updated: number
  skipped: number
  errors: CategoryCoverSyncError[]
  warnings?: string[]
}

export type CatalogProductListItem = {
  sku: string
  name: string
  price: number
  inStock: number
  imageUrls: string[]
  colors: string[]
  sizes: string[]
  category: string
  subcategory: string
  color?: string
  dimensionsLabel?: string
  colorTags?: string[]
}

export type CatalogProductDetail = CatalogProductListItem & {
  description: string
  specs: Record<string, string>
  variants: Variant[]
}
