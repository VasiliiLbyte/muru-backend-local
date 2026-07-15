import type { PoolClient } from 'pg'

import {
  mapBannerRowToCrm,
  mapBannerRowToPublic,
  mapCollectionRowToCrm,
  mapCollectionRowToPublic,
  mapLookbookRowToCrm,
  mapLookbookRowToPublic,
  mapPageRowToCrm,
  mapPageRowToPublic,
  parseImageJson,
} from './content.mapper'
import { listPublicHotspotsForLookbook } from './content-hotspots.service'
import { sanitizeContentHtml } from './content-sanitize.service'
import type {
  CollectionDto,
  ContentImage,
  CrmBannerDto,
  CrmCollectionDto,
  CrmLookbookDto,
  CrmPageDto,
  LookbookDto,
  PublicBannerDto,
  StaticPageDto,
} from '../types/content'
import { HttpError } from '../utils/api-response'
import { pool } from '../utils/db'

const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505'

const wrapDbError = (err: unknown): never => {
  if (isUniqueViolation(err)) {
    throw new HttpError(409, 'Slug already exists', 'CONFLICT')
  }
  throw err
}

const assertPositiveIntId = (id: number, label = 'id'): number => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, `Invalid ${label}`, 'VALIDATION')
  }
  return id
}

const fetchCollectionProductSlugs = async (
  client: PoolClient | typeof pool,
  collectionId: number,
): Promise<string[]> => {
  const result = await client.query<{ sku: string }>(
    `SELECT sku FROM content_collection_products
     WHERE collection_id = $1
     ORDER BY sort_order ASC, sku ASC`,
    [collectionId],
  )
  return result.rows.map((row) => row.sku)
}

const fetchLookbookImages = async (
  client: PoolClient | typeof pool,
  lookbookId: number,
): Promise<ContentImage[]> => {
  const result = await client.query<{ image: unknown }>(
    `SELECT image FROM content_lookbook_images
     WHERE lookbook_id = $1
     ORDER BY sort_order ASC, id ASC`,
    [lookbookId],
  )
  return result.rows
    .map((row) => parseImageJson(row.image))
    .filter((image): image is ContentImage => image !== undefined)
}

export const assertSkusExist = async (skus: string[]): Promise<void> => {
  if (skus.length === 0) return

  const uniqueSkus = [...new Set(skus)]
  const result = await pool.query<{ sku: string }>(
    `SELECT sku FROM products WHERE sku = ANY($1::text[])`,
    [uniqueSkus],
  )

  if (result.rows.length !== uniqueSkus.length) {
    const found = new Set(result.rows.map((row) => row.sku))
    const missing = uniqueSkus.filter((sku) => !found.has(sku))
    throw new HttpError(404, `Unknown SKU: ${missing.join(', ')}`, 'NOT_FOUND')
  }
}

// --- Pages ---

export const listCrmPages = async (): Promise<CrmPageDto[]> => {
  const result = await pool.query(
    `SELECT id, slug, title, body_html, seo_title, seo_description, is_visible, created_at, updated_at
     FROM content_pages
     ORDER BY slug ASC`,
  )
  return result.rows.map(mapPageRowToCrm)
}

export const getCrmPageById = async (id: number): Promise<CrmPageDto> => {
  const pageId = assertPositiveIntId(id)
  const result = await pool.query(
    `SELECT id, slug, title, body_html, seo_title, seo_description, is_visible, created_at, updated_at
     FROM content_pages WHERE id = $1`,
    [pageId],
  )
  const row = result.rows[0]
  if (!row) throw new HttpError(404, 'Page not found', 'NOT_FOUND')
  return mapPageRowToCrm(row)
}

export const getPublicPageBySlug = async (slug: string): Promise<StaticPageDto> => {
  const result = await pool.query(
    `SELECT id, slug, title, body_html, seo_title, seo_description, is_visible, created_at, updated_at
     FROM content_pages WHERE slug = $1 AND is_visible = true`,
    [slug],
  )
  const row = result.rows[0]
  if (!row) throw new HttpError(404, 'Page not found', 'NOT_FOUND')
  return mapPageRowToPublic(row)
}

export type UpsertPageInput = {
  slug: string
  title: string
  bodyHtml: string
  seoTitle?: string
  seoDescription?: string
  isVisible?: boolean
}

export const createPage = async (input: UpsertPageInput): Promise<CrmPageDto> => {
  const bodyHtml = sanitizeContentHtml(input.bodyHtml)
  try {
    const result = await pool.query(
      `INSERT INTO content_pages (slug, title, body_html, seo_title, seo_description, is_visible)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, slug, title, body_html, seo_title, seo_description, is_visible, created_at, updated_at`,
      [
        input.slug,
        input.title,
        bodyHtml,
        input.seoTitle ?? '',
        input.seoDescription ?? '',
        input.isVisible ?? true,
      ],
    )
    return mapPageRowToCrm(result.rows[0])
  } catch (err) {
    return wrapDbError(err)
  }
}

export const updatePage = async (id: number, input: UpsertPageInput): Promise<CrmPageDto> => {
  const pageId = assertPositiveIntId(id)
  const bodyHtml = sanitizeContentHtml(input.bodyHtml)
  try {
    const result = await pool.query(
      `UPDATE content_pages
       SET slug = $2, title = $3, body_html = $4, seo_title = $5, seo_description = $6,
           is_visible = $7, updated_at = NOW()
       WHERE id = $1
       RETURNING id, slug, title, body_html, seo_title, seo_description, is_visible, created_at, updated_at`,
      [
        pageId,
        input.slug,
        input.title,
        bodyHtml,
        input.seoTitle ?? '',
        input.seoDescription ?? '',
        input.isVisible ?? true,
      ],
    )
    const row = result.rows[0]
    if (!row) throw new HttpError(404, 'Page not found', 'NOT_FOUND')
    return mapPageRowToCrm(row)
  } catch (err) {
    if (err instanceof HttpError) throw err
    return wrapDbError(err)
  }
}

export const deletePage = async (id: number): Promise<void> => {
  const pageId = assertPositiveIntId(id)
  const result = await pool.query(`DELETE FROM content_pages WHERE id = $1 RETURNING id`, [pageId])
  if (!result.rows[0]) throw new HttpError(404, 'Page not found', 'NOT_FOUND')
}

// --- Collections ---

export const listCrmCollections = async (): Promise<CrmCollectionDto[]> => {
  const result = await pool.query(
    `SELECT id, slug, title, subtitle, description, hero_image, seo_title, seo_description,
            is_visible, sort_order, created_at, updated_at
     FROM content_collections
     ORDER BY sort_order ASC, slug ASC`,
  )
  const rows = await Promise.all(
    result.rows.map(async (row) => {
      const productSlugs = await fetchCollectionProductSlugs(pool, row.id)
      return mapCollectionRowToCrm(row, productSlugs)
    }),
  )
  return rows
}

export const getCrmCollectionById = async (id: number): Promise<CrmCollectionDto> => {
  const collectionId = assertPositiveIntId(id)
  const result = await pool.query(
    `SELECT id, slug, title, subtitle, description, hero_image, seo_title, seo_description,
            is_visible, sort_order, created_at, updated_at
     FROM content_collections WHERE id = $1`,
    [collectionId],
  )
  const row = result.rows[0]
  if (!row) throw new HttpError(404, 'Collection not found', 'NOT_FOUND')
  const productSlugs = await fetchCollectionProductSlugs(pool, row.id)
  return mapCollectionRowToCrm(row, productSlugs)
}

export const listPublicCollections = async (): Promise<CollectionDto[]> => {
  const result = await pool.query(
    `SELECT id, slug, title, subtitle, description, hero_image, seo_title, seo_description,
            is_visible, sort_order, created_at, updated_at
     FROM content_collections
     WHERE is_visible = true
     ORDER BY sort_order ASC, slug ASC`,
  )
  return Promise.all(
    result.rows.map(async (row) => {
      const productSlugs = await fetchCollectionProductSlugs(pool, row.id)
      return mapCollectionRowToPublic(row, productSlugs)
    }),
  )
}

export const getPublicCollectionBySlug = async (slug: string): Promise<CollectionDto> => {
  const result = await pool.query(
    `SELECT id, slug, title, subtitle, description, hero_image, seo_title, seo_description,
            is_visible, sort_order, created_at, updated_at
     FROM content_collections WHERE slug = $1 AND is_visible = true`,
    [slug],
  )
  const row = result.rows[0]
  if (!row) throw new HttpError(404, 'Collection not found', 'NOT_FOUND')
  const productSlugs = await fetchCollectionProductSlugs(pool, row.id)
  return mapCollectionRowToPublic(row, productSlugs)
}

export type UpsertCollectionInput = {
  slug: string
  title: string
  subtitle?: string | null
  description?: string | null
  heroImage?: ContentImage | null
  seoTitle?: string
  seoDescription?: string
  isVisible?: boolean
  sortOrder?: number
}

const sanitizeOptionalHtml = (value: string | null | undefined): string | null => {
  if (value == null) return null
  return sanitizeContentHtml(value)
}

export const createCollection = async (input: UpsertCollectionInput): Promise<CrmCollectionDto> => {
  const description = sanitizeOptionalHtml(input.description ?? null)
  try {
    const result = await pool.query(
      `INSERT INTO content_collections
         (slug, title, subtitle, description, hero_image, seo_title, seo_description, is_visible, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, slug, title, subtitle, description, hero_image, seo_title, seo_description,
                 is_visible, sort_order, created_at, updated_at`,
      [
        input.slug,
        input.title,
        input.subtitle ?? null,
        description,
        input.heroImage ? JSON.stringify(input.heroImage) : null,
        input.seoTitle ?? '',
        input.seoDescription ?? '',
        input.isVisible ?? true,
        input.sortOrder ?? 0,
      ],
    )
    return mapCollectionRowToCrm(result.rows[0], [])
  } catch (err) {
    return wrapDbError(err)
  }
}

export const updateCollection = async (
  id: number,
  input: UpsertCollectionInput,
): Promise<CrmCollectionDto> => {
  const collectionId = assertPositiveIntId(id)
  const description = sanitizeOptionalHtml(input.description ?? null)
  try {
    const result = await pool.query(
      `UPDATE content_collections
       SET slug = $2, title = $3, subtitle = $4, description = $5, hero_image = $6,
           seo_title = $7, seo_description = $8, is_visible = $9, sort_order = $10, updated_at = NOW()
       WHERE id = $1
       RETURNING id, slug, title, subtitle, description, hero_image, seo_title, seo_description,
                 is_visible, sort_order, created_at, updated_at`,
      [
        collectionId,
        input.slug,
        input.title,
        input.subtitle ?? null,
        description,
        input.heroImage ? JSON.stringify(input.heroImage) : null,
        input.seoTitle ?? '',
        input.seoDescription ?? '',
        input.isVisible ?? true,
        input.sortOrder ?? 0,
      ],
    )
    const row = result.rows[0]
    if (!row) throw new HttpError(404, 'Collection not found', 'NOT_FOUND')
    const productSlugs = await fetchCollectionProductSlugs(pool, row.id)
    return mapCollectionRowToCrm(row, productSlugs)
  } catch (err) {
    if (err instanceof HttpError) throw err
    return wrapDbError(err)
  }
}

export const deleteCollection = async (id: number): Promise<void> => {
  const collectionId = assertPositiveIntId(id)
  const result = await pool.query(`DELETE FROM content_collections WHERE id = $1 RETURNING id`, [
    collectionId,
  ])
  if (!result.rows[0]) throw new HttpError(404, 'Collection not found', 'NOT_FOUND')
}

export type CollectionProductInput = { sku: string; sortOrder: number }

export const setCollectionProducts = async (
  id: number,
  items: CollectionProductInput[],
): Promise<CrmCollectionDto> => {
  const collectionId = assertPositiveIntId(id)
  const skus = items.map((item) => item.sku)
  await assertSkusExist(skus)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const exists = await client.query(`SELECT id FROM content_collections WHERE id = $1`, [
      collectionId,
    ])
    if (!exists.rows[0]) throw new HttpError(404, 'Collection not found', 'NOT_FOUND')

    await client.query(`DELETE FROM content_collection_products WHERE collection_id = $1`, [
      collectionId,
    ])

    for (const item of items) {
      await client.query(
        `INSERT INTO content_collection_products (collection_id, sku, sort_order)
         VALUES ($1, $2, $3)`,
        [collectionId, item.sku, item.sortOrder],
      )
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return getCrmCollectionById(collectionId)
}

// --- Lookbooks ---

export const listCrmLookbooks = async (): Promise<CrmLookbookDto[]> => {
  const result = await pool.query(
    `SELECT id, slug, title, description, cover_image, banner_image, seo_title, seo_description,
            is_visible, sort_order, created_at, updated_at
     FROM content_lookbooks
     ORDER BY sort_order ASC, slug ASC`,
  )
  return Promise.all(
    result.rows.map(async (row) => {
      const images = await fetchLookbookImages(pool, row.id)
      return mapLookbookRowToCrm(row, images)
    }),
  )
}

export const getCrmLookbookById = async (id: number): Promise<CrmLookbookDto> => {
  const lookbookId = assertPositiveIntId(id)
  const result = await pool.query(
    `SELECT id, slug, title, description, cover_image, banner_image, seo_title, seo_description,
            is_visible, sort_order, created_at, updated_at
     FROM content_lookbooks WHERE id = $1`,
    [lookbookId],
  )
  const row = result.rows[0]
  if (!row) throw new HttpError(404, 'Lookbook not found', 'NOT_FOUND')
  const images = await fetchLookbookImages(pool, row.id)
  return mapLookbookRowToCrm(row, images)
}

export const listPublicLookbooks = async (): Promise<LookbookDto[]> => {
  const result = await pool.query(
    `SELECT id, slug, title, description, cover_image, seo_title, seo_description,
            is_visible, sort_order, created_at, updated_at
     FROM content_lookbooks
     WHERE is_visible = true
     ORDER BY sort_order ASC, slug ASC`,
  )
  return Promise.all(
    result.rows.map(async (row) => {
      const images = await fetchLookbookImages(pool, row.id)
      return mapLookbookRowToPublic(row, images)
    }),
  )
}

export const getPublicLookbookBySlug = async (slug: string): Promise<LookbookDto> => {
  const result = await pool.query(
    `SELECT id, slug, title, description, cover_image, banner_image, seo_title, seo_description,
            is_visible, sort_order, created_at, updated_at
     FROM content_lookbooks WHERE slug = $1 AND is_visible = true`,
    [slug],
  )
  const row = result.rows[0]
  if (!row) throw new HttpError(404, 'Lookbook not found', 'NOT_FOUND')
  const images = await fetchLookbookImages(pool, row.id)
  const dto = mapLookbookRowToPublic(row, images, { includeBanner: true })
  const hotspots = await listPublicHotspotsForLookbook(row.id)
  if (hotspots.length > 0) {
    dto.hotspots = hotspots
  }
  return dto
}

export type UpsertLookbookInput = {
  slug: string
  title: string
  description?: string | null
  coverImage?: ContentImage | null
  bannerImage?: ContentImage | null
  seoTitle?: string
  seoDescription?: string
  isVisible?: boolean
  sortOrder?: number
}

export const createLookbook = async (input: UpsertLookbookInput): Promise<CrmLookbookDto> => {
  const description = sanitizeOptionalHtml(input.description ?? null)
  try {
    const result = await pool.query(
      `INSERT INTO content_lookbooks
         (slug, title, description, cover_image, banner_image, seo_title, seo_description, is_visible, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, slug, title, description, cover_image, banner_image, seo_title, seo_description,
                 is_visible, sort_order, created_at, updated_at`,
      [
        input.slug,
        input.title,
        description,
        input.coverImage ? JSON.stringify(input.coverImage) : null,
        input.bannerImage ? JSON.stringify(input.bannerImage) : null,
        input.seoTitle ?? '',
        input.seoDescription ?? '',
        input.isVisible ?? true,
        input.sortOrder ?? 0,
      ],
    )
    return mapLookbookRowToCrm(result.rows[0], [])
  } catch (err) {
    return wrapDbError(err)
  }
}

export const updateLookbook = async (
  id: number,
  input: UpsertLookbookInput,
): Promise<CrmLookbookDto> => {
  const lookbookId = assertPositiveIntId(id)
  const description = sanitizeOptionalHtml(input.description ?? null)
  try {
    const result = await pool.query(
      `UPDATE content_lookbooks
       SET slug = $2, title = $3, description = $4, cover_image = $5, banner_image = $6,
           seo_title = $7, seo_description = $8, is_visible = $9, sort_order = $10, updated_at = NOW()
       WHERE id = $1
       RETURNING id, slug, title, description, cover_image, banner_image, seo_title, seo_description,
                 is_visible, sort_order, created_at, updated_at`,
      [
        lookbookId,
        input.slug,
        input.title,
        description,
        input.coverImage ? JSON.stringify(input.coverImage) : null,
        input.bannerImage ? JSON.stringify(input.bannerImage) : null,
        input.seoTitle ?? '',
        input.seoDescription ?? '',
        input.isVisible ?? true,
        input.sortOrder ?? 0,
      ],
    )
    const row = result.rows[0]
    if (!row) throw new HttpError(404, 'Lookbook not found', 'NOT_FOUND')
    const images = await fetchLookbookImages(pool, row.id)
    return mapLookbookRowToCrm(row, images)
  } catch (err) {
    if (err instanceof HttpError) throw err
    return wrapDbError(err)
  }
}

export const deleteLookbook = async (id: number): Promise<void> => {
  const lookbookId = assertPositiveIntId(id)
  const result = await pool.query(`DELETE FROM content_lookbooks WHERE id = $1 RETURNING id`, [
    lookbookId,
  ])
  if (!result.rows[0]) throw new HttpError(404, 'Lookbook not found', 'NOT_FOUND')
}

export type LookbookImageInput = { image: ContentImage; sortOrder: number }

export const setLookbookImages = async (
  id: number,
  items: LookbookImageInput[],
): Promise<CrmLookbookDto> => {
  const lookbookId = assertPositiveIntId(id)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const exists = await client.query(`SELECT id FROM content_lookbooks WHERE id = $1`, [lookbookId])
    if (!exists.rows[0]) throw new HttpError(404, 'Lookbook not found', 'NOT_FOUND')

    await client.query(`DELETE FROM content_lookbook_images WHERE lookbook_id = $1`, [lookbookId])

    for (const item of items) {
      await client.query(
        `INSERT INTO content_lookbook_images (lookbook_id, image, sort_order)
         VALUES ($1, $2, $3)`,
        [lookbookId, JSON.stringify(item.image), item.sortOrder],
      )
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return getCrmLookbookById(lookbookId)
}

// --- Banners ---

export const listCrmBanners = async (): Promise<CrmBannerDto[]> => {
  const result = await pool.query(
    `SELECT id, title, subtitle, href, image, sort_order, is_active, starts_at, ends_at, created_at, updated_at
     FROM content_banners
     ORDER BY sort_order ASC, id ASC`,
  )
  return result.rows.map(mapBannerRowToCrm)
}

export const getCrmBannerById = async (id: number): Promise<CrmBannerDto> => {
  const bannerId = assertPositiveIntId(id)
  const result = await pool.query(
    `SELECT id, title, subtitle, href, image, sort_order, is_active, starts_at, ends_at, created_at, updated_at
     FROM content_banners WHERE id = $1`,
    [bannerId],
  )
  const row = result.rows[0]
  if (!row) throw new HttpError(404, 'Banner not found', 'NOT_FOUND')
  return mapBannerRowToCrm(row)
}

export const listPublicBanners = async (): Promise<PublicBannerDto[]> => {
  const result = await pool.query(
    `SELECT id, title, subtitle, href, image, sort_order, is_active, starts_at, ends_at, created_at, updated_at
     FROM content_banners
     WHERE is_active = true
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (ends_at IS NULL OR ends_at >= NOW())
     ORDER BY sort_order ASC, id ASC`,
  )
  return result.rows.map(mapBannerRowToPublic)
}

export type UpsertBannerInput = {
  title: string
  subtitle?: string | null
  href?: string | null
  image?: ContentImage | null
  sortOrder?: number
  isActive?: boolean
  startsAt?: string | null
  endsAt?: string | null
}

export const createBanner = async (input: UpsertBannerInput): Promise<CrmBannerDto> => {
  const result = await pool.query(
    `INSERT INTO content_banners
       (title, subtitle, href, image, sort_order, is_active, starts_at, ends_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, title, subtitle, href, image, sort_order, is_active, starts_at, ends_at, created_at, updated_at`,
    [
      input.title,
      input.subtitle ?? null,
      input.href ?? null,
      input.image ? JSON.stringify(input.image) : null,
      input.sortOrder ?? 0,
      input.isActive ?? true,
      input.startsAt ?? null,
      input.endsAt ?? null,
    ],
  )
  return mapBannerRowToCrm(result.rows[0])
}

export const updateBanner = async (id: number, input: UpsertBannerInput): Promise<CrmBannerDto> => {
  const bannerId = assertPositiveIntId(id)
  const result = await pool.query(
    `UPDATE content_banners
     SET title = $2, subtitle = $3, href = $4, image = $5, sort_order = $6,
         is_active = $7, starts_at = $8, ends_at = $9, updated_at = NOW()
     WHERE id = $1
     RETURNING id, title, subtitle, href, image, sort_order, is_active, starts_at, ends_at, created_at, updated_at`,
    [
      bannerId,
      input.title,
      input.subtitle ?? null,
      input.href ?? null,
      input.image ? JSON.stringify(input.image) : null,
      input.sortOrder ?? 0,
      input.isActive ?? true,
      input.startsAt ?? null,
      input.endsAt ?? null,
    ],
  )
  const row = result.rows[0]
  if (!row) throw new HttpError(404, 'Banner not found', 'NOT_FOUND')
  return mapBannerRowToCrm(row)
}

export const deleteBanner = async (id: number): Promise<void> => {
  const bannerId = assertPositiveIntId(id)
  const result = await pool.query(`DELETE FROM content_banners WHERE id = $1 RETURNING id`, [
    bannerId,
  ])
  if (!result.rows[0]) throw new HttpError(404, 'Banner not found', 'NOT_FOUND')
}
