/**
 * Builds product image URL list for sync. When placeholderUrl is set, always returns exactly two URLs
 * (Drive placeholder fills missing slots). When null, returns product URLs only (legacy upsert fallback).
 */
export function buildTwoSlotImageUrls(
  productImageUrls: string[],
  placeholderUrl: string | null,
): string[] {
  if (!placeholderUrl) {
    return productImageUrls
  }
  const first = productImageUrls[0] ?? placeholderUrl
  const second = productImageUrls[1] ?? placeholderUrl
  return [first, second]
}
