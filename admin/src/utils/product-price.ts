/** Sale (pay) price from list + discount %. Mirrors backend product-price-math. */
export const salePriceFromList = (listPrice: number, discountPercent: number): number => {
  const list = Number(listPrice)
  const d = Number(discountPercent) || 0
  if (!Number.isFinite(list) || list < 0) return 0
  if (d <= 0) return Math.round(list * 100) / 100
  if (d >= 100) return 0
  return Math.round(list * (1 - d / 100) * 100) / 100
}
