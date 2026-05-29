/** ILIKE filter for product list queries (name + SKU/article). */
export const buildProductTextSearchCondition = (
  values: Array<string | number>,
  q: string,
): string | null => {
  const trimmed = q.trim()
  if (!trimmed) return null
  values.push(`%${trimmed}%`)
  const idx = values.length
  return `(p.name ILIKE $${idx} OR p.sku ILIKE $${idx})`
}
