import type {
  CreateCrmSubcategoryInput,
  PatchCrmSubcategoryInput,
} from '../schemas/crm-catalog.schemas'
import { pool } from '../utils/db'
import { extractDriveFileId } from '../utils/drive-file-id'

import { SALE_CATEGORY_NAME } from '../constants/catalog-top-level'

import { assertCatalogCrmWritable } from './catalog-source.guard'
import { conflictError, isUniqueViolation, slugify } from './crm-catalog.helpers'
import { invalidateImageCache } from './image-proxy.service'

/** Append/replace cache-bust `v` query param on cover URLs (C1). */
export const withCoverCacheBust = (url: string, versionMs = Date.now()): string => {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    const parsed = new URL(trimmed, hasScheme ? undefined : 'https://muru.local')
    parsed.searchParams.delete('v')
    parsed.searchParams.set('v', String(versionMs))
    if (!hasScheme) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    }
    return parsed.toString()
  } catch {
    const stripped = trimmed
      .replace(/([?&])v=[^&]*/gi, '$1')
      .replace(/[?&]$/, '')
      .replace(/\?&/, '?')
    const sep = stripped.includes('?') ? '&' : '?'
    return `${stripped}${sep}v=${versionMs}`
  }
}

export type CrmSubcategoryItem = {
  id: number
  categoryId: number
  name: string
  slug: string
  coverImageUrl: string | null
  sortOrder: number
  productCount: number
  seoTitle: string
  seoDescription: string
  seoH1: string
  seoIntroTop: string
  seoTextBottom: string
}

type SubcategoryRow = {
  id: number
  category_id: number
  name: string
  slug: string
  cover_image_url: string | null
  sort_order: number
  product_count: number
  seo_title: string
  seo_description: string
  seo_h1: string
  seo_intro_top: string
  seo_text_bottom: string
}

const mapRow = (row: SubcategoryRow): CrmSubcategoryItem => ({
  id: row.id,
  categoryId: row.category_id,
  name: row.name,
  slug: row.slug,
  coverImageUrl: row.cover_image_url,
  sortOrder: row.sort_order,
  productCount: row.product_count,
  seoTitle: row.seo_title ?? '',
  seoDescription: row.seo_description ?? '',
  seoH1: row.seo_h1 ?? '',
  seoIntroTop: row.seo_intro_top ?? '',
  seoTextBottom: row.seo_text_bottom ?? '',
})

/**
 * Subcategory slugs must be unique across the whole catalog, not just per category:
 * the storefront and SEO redirects key subcategories by slug, so a second `svet` under
 * another category silently moves products between listings.
 */
const assertSubcategorySlugAvailable = async (slug: string, categoryId: number): Promise<void> => {
  const result = await pool.query<{ kind?: 'category' | 'subcategory'; owner?: string }>(
    `SELECT 'category' AS kind, name AS owner FROM categories WHERE slug = $1
     UNION ALL
     SELECT 'subcategory' AS kind, c.name AS owner
     FROM subcategories s JOIN categories c ON c.id = s.category_id
     WHERE s.slug = $1 AND s.category_id <> $2
     LIMIT 1`,
    [slug, categoryId],
  )
  const hit = result.rows[0]
  if (!hit) return
  if (hit.kind === 'subcategory') {
    throw conflictError(
      `Slug «${slug}» уже используется подкатегорией в категории «${hit.owner}». Укажите другой slug.`,
    )
  }
  throw conflictError('Slug совпадает с категорией верхнего уровня. Выберите другое название.')
}

/** Products copy their primary subcategory name/slug; keep the copy in sync on rename. */
const syncProductSubcategoryDenorm = async (
  subcategoryId: number,
  oldSlug: string,
  next: { name: string; slug: string },
): Promise<void> => {
  await pool.query(
    `UPDATE products p SET
       web_subcategory_name = $1,
       web_subcategory_slug = $2,
       subcategory = $1,
       subcategory_slug = $2,
       updated_at = NOW()
     WHERE (p.web_subcategory_slug = $3 OR p.subcategory_slug = $3)
       AND EXISTS (
         SELECT 1 FROM product_subcategories ps
         WHERE ps.product_id = p.id AND ps.subcategory_id = $4
       )`,
    [next.name, next.slug, oldSlug, subcategoryId],
  )
}

const SUBCATEGORY_SELECT = `
  SELECT s.id, s.category_id, s.name, s.slug, s.cover_image_url, s.sort_order,
         s.seo_title, s.seo_description, s.seo_h1, s.seo_intro_top, s.seo_text_bottom,
         COUNT(DISTINCT ps.product_id) FILTER (WHERE p.is_archived = FALSE)::int AS product_count
  FROM subcategories s
  LEFT JOIN product_subcategories ps ON ps.subcategory_id = s.id
  LEFT JOIN products p ON p.id = ps.product_id
`

export const listCrmSubcategories = async (categoryId: number): Promise<CrmSubcategoryItem[]> => {
  const result = await pool.query<SubcategoryRow>(
    `${SUBCATEGORY_SELECT}
     WHERE s.category_id = $1
     GROUP BY s.id
     ORDER BY s.sort_order, s.name`,
    [categoryId],
  )
  return result.rows.map(mapRow)
}

export const createCrmSubcategory = async (
  categoryId: number,
  input: CreateCrmSubcategoryInput,
): Promise<CrmSubcategoryItem> => {
  assertCatalogCrmWritable()

  const cat = await pool.query<{ name: string }>(
    'SELECT name FROM categories WHERE id = $1',
    [categoryId],
  )
  if (cat.rows[0]?.name === SALE_CATEGORY_NAME) {
    throw conflictError('У виртуальной «Распродажи» не бывает подкатегорий.')
  }

  const name = input.name.trim()
  const slug = slugify(name)
  await assertSubcategorySlugAvailable(slug, categoryId)

  try {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO subcategories (category_id, name, slug, cover_image_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [categoryId, name, slug, input.coverImageUrl ?? null],
    )
    const items = await listCrmSubcategories(categoryId)
    const created = items.find((item) => item.id === result.rows[0].id)
    if (!created) throw new Error('Не удалось создать подкатегорию.')
    return created
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflictError('Подкатегория с таким slug уже есть в этой категории.')
    }
    throw error
  }
}

export const updateCrmSubcategory = async (
  categoryId: number,
  subcategoryId: number,
  input: PatchCrmSubcategoryInput,
): Promise<CrmSubcategoryItem | null> => {
  assertCatalogCrmWritable()

  const sets: string[] = []
  const params: unknown[] = []
  let nextName: string | undefined
  let nextSlug: string | undefined

  if (input.name !== undefined) {
    nextName = input.name.trim()
    params.push(nextName)
    sets.push(`name = $${params.length}`)
    if (input.slug === undefined) {
      nextSlug = slugify(nextName)
      await assertSubcategorySlugAvailable(nextSlug, categoryId)
      params.push(nextSlug)
      sets.push(`slug = $${params.length}`)
    }
  }
  if (input.slug !== undefined) {
    nextSlug = input.slug.trim()
    await assertSubcategorySlugAvailable(nextSlug, categoryId)
    params.push(nextSlug)
    sets.push(`slug = $${params.length}`)
  }

  const renaming = nextName !== undefined || nextSlug !== undefined
  const before = renaming ? await getSubcategoryDenormById(subcategoryId) : null
  if (input.coverImageUrl !== undefined) {
    const cover =
      input.coverImageUrl === null || input.coverImageUrl.trim() === ''
        ? null
        : withCoverCacheBust(input.coverImageUrl)
    params.push(cover)
    sets.push(`cover_image_url = $${params.length}`)
    if (cover) {
      const fileId = extractDriveFileId(cover)
      if (fileId && !fileId.startsWith('crm_')) {
        void invalidateImageCache([fileId]).catch(() => undefined)
      }
    }
  }
  if (input.sortOrder !== undefined) {
    params.push(input.sortOrder)
    sets.push(`sort_order = $${params.length}`)
  }
  if (input.seoTitle !== undefined) {
    params.push(input.seoTitle ?? '')
    sets.push(`seo_title = $${params.length}`)
  }
  if (input.seoDescription !== undefined) {
    params.push(input.seoDescription ?? '')
    sets.push(`seo_description = $${params.length}`)
  }
  if (input.seoH1 !== undefined) {
    params.push(input.seoH1 ?? '')
    sets.push(`seo_h1 = $${params.length}`)
  }
  if (input.seoIntroTop !== undefined) {
    params.push(input.seoIntroTop ?? '')
    sets.push(`seo_intro_top = $${params.length}`)
  }
  if (input.seoTextBottom !== undefined) {
    params.push(input.seoTextBottom ?? '')
    sets.push(`seo_text_bottom = $${params.length}`)
  }

  if (sets.length === 0) {
    throw new Error('Нет полей для сохранения.')
  }

  params.push(subcategoryId, categoryId)

  try {
    const result = await pool.query(
      `UPDATE subcategories SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND category_id = $${params.length}`,
      params,
    )
    if ((result.rowCount ?? 0) === 0) return null

    if (before) {
      const next = { name: nextName ?? before.name, slug: nextSlug ?? before.slug }
      if (next.name !== before.name || next.slug !== before.slug) {
        await syncProductSubcategoryDenorm(subcategoryId, before.slug, next)
      }
    }

    const items = await listCrmSubcategories(categoryId)
    return items.find((item) => item.id === subcategoryId) ?? null
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflictError('Подкатегория с таким slug уже есть в этой категории.')
    }
    throw error
  }
}

export const deleteCrmSubcategory = async (
  categoryId: number,
  subcategoryId: number,
): Promise<boolean> => {
  assertCatalogCrmWritable()

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM product_subcategories ps
     INNER JOIN products p ON p.id = ps.product_id AND p.is_archived = FALSE
     WHERE ps.subcategory_id = $1`,
    [subcategoryId],
  )
  const activeCount = Number(countResult.rows[0]?.count ?? 0)
  if (activeCount > 0) {
    throw conflictError('В подкатегории есть активные товары.')
  }

  const result = await pool.query(
    `DELETE FROM subcategories WHERE id = $1 AND category_id = $2`,
    [subcategoryId, categoryId],
  )
  return (result.rowCount ?? 0) > 0
}

export const getSubcategoryDenormById = async (
  subcategoryId: number,
): Promise<{ name: string; slug: string } | null> => {
  const result = await pool.query<{ name: string; slug: string }>(
    `SELECT name, slug FROM subcategories WHERE id = $1`,
    [subcategoryId],
  )
  return result.rows[0] ?? null
}

export const validateSubcategoryIdsExist = async (ids: number[]): Promise<void> => {
  if (ids.length === 0) return
  const result = await pool.query<{ id: number }>(
    `SELECT id FROM subcategories WHERE id = ANY($1::int[])`,
    [ids],
  )
  if (result.rows.length !== ids.length) {
    const found = new Set(result.rows.map((row) => row.id))
    const missing = ids.filter((id) => !found.has(id))
    const err = new Error(`Неизвестная подкатегория: ${missing.join(', ')}`)
    ;(err as Error & { statusCode?: number }).statusCode = 400
    throw err
  }
}
