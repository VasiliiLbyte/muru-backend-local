export type CatalogNode = {
  name: string
  slug: string
  children: CatalogNode[]
}

export type CatalogProduct = {
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

export type CatalogVariant = {
  color?: string
  size?: string
}

export type CatalogProductDetail = CatalogProduct & {
  description: string
  specs: Record<string, string>
  variants: CatalogVariant[]
}
