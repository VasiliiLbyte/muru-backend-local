import { pool } from '../utils/db'

import { conflictError, slugify } from './crm-catalog.helpers'

const SLUG_FORMAT = /^[a-z0-9-]+$/

export type ResolveProductSlugInput = {
  name: string
  sku: string
  explicitSlug?: string
  excludeProductId?: number
}

const isSlugTaken = async (slug: string, excludeProductId?: number): Promise<boolean> => {
  const result = await pool.query<{ id: number }>(
    'SELECT id FROM products WHERE slug = $1 AND ($2::int IS NULL OR id <> $2) LIMIT 1',
    [slug, excludeProductId ?? null],
  )
  return result.rows.length > 0
}

const assertSlugFormat = (slug: string): void => {
  if (!SLUG_FORMAT.test(slug)) {
    throw conflictError('Некорректный slug товара.')
  }
}

/**
 * Resolve product slug for create or explicit slug update (SLUG-001).
 * Auto path: base → `${base}-{sku}` → `${base}-{sku}-2`, …
 * Explicit path: 409 when slug is taken by another product.
 */
export const resolveProductSlugForCreate = async (
  input: ResolveProductSlugInput,
): Promise<string> => {
  const explicit = input.explicitSlug?.trim()
  if (explicit) {
    const next = explicit.toLowerCase()
    assertSlugFormat(next)
    if (await isSlugTaken(next, input.excludeProductId)) {
      throw conflictError(`Товар со slug ${next} уже существует.`)
    }
    return next
  }

  const base = slugify(input.name).toLowerCase()
  assertSlugFormat(base)

  if (!(await isSlugTaken(base, input.excludeProductId))) {
    return base
  }

  const withSku = `${base}-${input.sku.toLowerCase()}`
  if (!(await isSlugTaken(withSku, input.excludeProductId))) {
    return withSku
  }

  let n = 2
  for (;;) {
    const candidate = `${withSku}-${n}`
    if (!(await isSlugTaken(candidate, input.excludeProductId))) {
      return candidate
    }
    n += 1
  }
}
