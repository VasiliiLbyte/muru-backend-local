/** Round money to 2 decimal places (kopecks). */
export const roundMoney2 = (value: number): number => Math.round(value * 100) / 100

/**
 * Sale (pay) price from list price + discount %.
 * Canon: products.price = list; sale = list × (1 − d/100).
 */
export const salePriceFromList = (listPrice: number, discountPercent: number): number => {
  const list = Number(listPrice)
  const d = Number(discountPercent) || 0
  if (!Number.isFinite(list) || list < 0) return 0
  if (d <= 0) return roundMoney2(list)
  if (d >= 100) return 0
  return roundMoney2(list * (1 - d / 100))
}

/**
 * Restore list price from a sale price that was stored incorrectly with discount %.
 * Used by migration 039 (sale → list).
 */
export const listPriceFromSale = (salePrice: number, discountPercent: number): number => {
  const sale = Number(salePrice)
  const d = Number(discountPercent) || 0
  if (!Number.isFinite(sale) || sale < 0) return 0
  if (d <= 0 || d >= 100) return roundMoney2(sale)
  return roundMoney2(sale / (1 - d / 100))
}
