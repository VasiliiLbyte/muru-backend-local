/** Main (_1_O) + up to two additional (_2_O, _3_O) in catalog carousel. */
export const MAX_CATALOG_IMAGE_URLS = 3

/**
 * Builds `image_urls` for sync. Drive placeholder is used only when the product has **no** SKU-matched
 * images in Drive — not as a synthetic second slide when one real photo exists (avoids double dots in UI).
 */
export function buildTwoSlotImageUrls(
  productImageUrls: string[],
  placeholderUrl: string | null,
): string[] {
  const capped = productImageUrls.slice(0, MAX_CATALOG_IMAGE_URLS)
  if (!placeholderUrl) {
    return capped
  }
  if (capped.length >= MAX_CATALOG_IMAGE_URLS) {
    return [capped[0], capped[1], capped[2]]
  }
  if (capped.length === 2) {
    return [capped[0], capped[1]]
  }
  if (capped.length === 1) {
    return [capped[0]]
  }
  return [placeholderUrl]
}
