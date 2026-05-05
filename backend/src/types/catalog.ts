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
  imageUrls: [string, string]
}

export type SyncError = {
  sku: string
  reason: string
}

export type SyncResult = {
  totalRows: number
  syncedProducts: number
  skippedProducts: number
  errors: SyncError[]
}

export type CatalogNode = {
  name: string
  slug: string
  children: CatalogNode[]
}

export type CatalogProductListItem = {
  sku: string
  name: string
  price: number
  inStock: number
  imageUrls: [string, string]
  colors: string[]
  sizes: string[]
  category: string
  subcategory: string
}
