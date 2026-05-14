import type { CategoryCoverSyncResult } from '../types/catalog'
import { TOP_LEVEL_CATEGORIES } from '../constants/catalog-top-level'
import { pool } from '../utils/db'

import {
  buildDriveNameToIdMap,
  resolveFileIdByName,
  validateCoverDriveFilename,
} from './category-cover-filename'
import {
  buildDriveThumbnailUrl,
  createMuruDriveClient,
  ensureDriveFileIsPublic,
  listMuruFolderImageFiles,
} from './google-drive-muru-folder'

const topLevelNames = [...TOP_LEVEL_CATEGORIES]

export const syncCategoryCoversFromDrive = async (): Promise<CategoryCoverSyncResult> => {
  const [files, categoriesResult] = await Promise.all([
    listMuruFolderImageFiles(),
    pool.query<{
      id: number
      slug: string
      cover_drive_filename: string | null
    }>(
      `SELECT id, slug, cover_drive_filename FROM categories
       WHERE cover_drive_filename IS NOT NULL AND TRIM(cover_drive_filename) <> ''
         AND name = ANY($1::text[])`,
      [topLevelNames],
    ),
  ])

  const { map: nameToId, warnings: duplicateWarnings } = buildDriveNameToIdMap(files)
  const drive = createMuruDriveClient()

  const errors: CategoryCoverSyncResult['errors'] = []
  let updated = 0
  let skipped = 0

  for (const row of categoriesResult.rows) {
    const rawName = row.cover_drive_filename?.trim() ?? ''
    const validated = validateCoverDriveFilename(rawName)
    if (!validated.ok) {
      errors.push({ categoryId: row.id, slug: row.slug, reason: validated.message })
      skipped += 1
      continue
    }
    if (!validated.value) {
      skipped += 1
      continue
    }

    const fileId = resolveFileIdByName(nameToId, validated.value)
    if (!fileId) {
      errors.push({
        categoryId: row.id,
        slug: row.slug,
        reason: `No file "${validated.value}" in Drive folder`,
      })
      skipped += 1
      continue
    }

    await ensureDriveFileIsPublic(drive, fileId)
    const url = buildDriveThumbnailUrl(fileId)
    await pool.query(`UPDATE categories SET cover_image_url = $1 WHERE id = $2`, [url, row.id])
    updated += 1
  }

  return {
    updated,
    skipped,
    errors,
    ...(duplicateWarnings.length > 0 ? { warnings: duplicateWarnings } : {}),
  }
}
