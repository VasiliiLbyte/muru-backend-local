import { z } from 'zod'

import { TOP_LEVEL_CATEGORIES } from '../constants/catalog-top-level'
import type { AdminCategoryRow } from '../types/catalog'
import { pool } from '../utils/db'

import { validateCoverDriveFilename } from './category-cover-filename'

const topLevelNames = [...TOP_LEVEL_CATEGORIES]

export const listAdminCategories = async (): Promise<AdminCategoryRow[]> => {
  const result = await pool.query<{
    id: number
    name: string
    slug: string
    cover_drive_filename: string | null
    cover_image_url: string | null
  }>(
    `SELECT id, name, slug, cover_drive_filename, cover_image_url
     FROM categories
     WHERE name = ANY($1::text[])
     ORDER BY array_position($1::text[], name::text)`,
    [topLevelNames],
  )
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    coverDriveFilename: row.cover_drive_filename,
    coverImageUrl: row.cover_image_url,
  }))
}

const coverItemSchema = z.object({
  id: z.number().int().positive(),
  coverDriveFilename: z.union([z.string(), z.null()]).optional(),
})

const coversBodySchema = z.object({
  items: z.array(coverItemSchema).max(500),
})

export type SaveCategoryCoversInput = z.infer<typeof coversBodySchema>

export const saveCategoryCovers = async (body: unknown): Promise<{ saved: number; validationErrors: string[] }> => {
  const parsed = coversBodySchema.safeParse(body)
  if (!parsed.success) {
    return { saved: 0, validationErrors: [parsed.error.message] }
  }
  const client = await pool.connect()
  const validationErrors: string[] = []
  let saved = 0
  try {
    await client.query('BEGIN')
    for (const item of parsed.data.items) {
      const raw = item.coverDriveFilename
      const validated = validateCoverDriveFilename(raw ?? null)
      if (!validated.ok) {
        validationErrors.push(`id ${item.id}: ${validated.message}`)
        continue
      }
      const filename = validated.value
      if (filename === null) {
        await client.query(
          `UPDATE categories SET cover_drive_filename = NULL, cover_image_url = NULL WHERE id = $1`,
          [item.id],
        )
      } else {
        await client.query(
          `UPDATE categories SET cover_drive_filename = $1, cover_image_url = NULL WHERE id = $2`,
          [filename, item.id],
        )
      }
      saved += 1
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return { saved, validationErrors }
}
