/**
 * Builds `image_urls` for sync. Drive placeholder is used only when the product has **no** SKU-matched
 * images in Drive — not as a synthetic second slide when one real photo exists (avoids double dots in UI).
 * One URL in the array is enough: `upsertProduct` duplicates into `image_url_2` when needed.
 */
export function buildTwoSlotImageUrls(
  productImageUrls: string[],
  placeholderUrl: string | null,
): string[] {
  if (!placeholderUrl) {
    return productImageUrls
  }
  if (productImageUrls.length >= 2) {
    return [productImageUrls[0], productImageUrls[1]]
  }
  if (productImageUrls.length === 1) {
    return [productImageUrls[0]]
  }
  return [placeholderUrl]
}
