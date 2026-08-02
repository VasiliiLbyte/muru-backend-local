export type FavoriteItem = {
  sku: string
  name: string
  /** List price (products.price). Sale = price × (1 − discountPercent/100). */
  price: number
  discountPercent?: number
  imageUrl: string
  inStock: number
}
