export type FavoriteItem = {
  sku: string
  name: string
  price: number
  imageUrl: string
  inStock: number
}

export type FavoritePayload = {
  telegramUserId: number
  sku: string
}

