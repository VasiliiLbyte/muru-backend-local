import type { CategoryCoverSyncResult } from '../types/catalog'
import { TOP_LEVEL_CATEGORIES } from '../constants/catalog-top-level'
import { pool } from '../utils/db'

import {
  buildDriveNameToIdMap,
  resolveFileIdByName,
  validateCoverDriveFilename,
} from './category-cover-filename'
import {
  getCachedDriveFilenameIndex,
  setDriveFilenameIndexFromFiles,
} from './drive-filename-index-cache'
import {
  buildDriveThumbnailUrl,
  createMuruDriveClient,
  ensureDriveFileIsPublic,
  listMuruFolderImageFiles,
  resolveDriveImageFilesByNames,
} from './google-drive-muru-folder'

const topLevelNames = [...TOP_LEVEL_CATEGORIES]

export type CategoryCoverSyncPhase = 'lookup' | 'publish' | 'done'

export type CategoryCoverSyncProgress = {
  phase: CategoryCoverSyncPhase
  message: string
  foldersScanned?: number
  imagesSeen?: number
  resolvedCount?: number
  totalCategories?: number
}

export type CategoryCoverSyncProgressReporter = (progress: CategoryCoverSyncProgress) => void

const report = (reporter: CategoryCoverSyncProgressReporter | undefined, progress: CategoryCoverSyncProgress) => {
  reporter?.(progress)
}

const loadCategoriesWithCovers = async () =>
  pool.query<{
    id: number
    slug: string
    cover_drive_filename: string | null
  }>(
    `SELECT id, slug, cover_drive_filename FROM categories
     WHERE cover_drive_filename IS NOT NULL AND TRIM(cover_drive_filename) <> ''
       AND name = ANY($1::text[])`,
    [topLevelNames],
  )

const buildNameToIdForFilenames = async (
  filenames: string[],
  reporter?: CategoryCoverSyncProgressReporter,
): Promise<{ nameToId: Map<string, string>; warnings: string[] }> => {
  const warnings: string[] = []
  const nameToId = new Map<string, string>()
  const unique = [...new Set(filenames)]

  const cached = getCachedDriveFilenameIndex()
  if (cached) {
    report(reporter, {
      phase: 'lookup',
      message: 'Используем кэш Drive (после синка каталога)…',
      totalCategories: unique.length,
    })
    for (const name of unique) {
      const id = cached.get(name.toLowerCase())
      if (id) nameToId.set(name.toLowerCase(), id)
    }
    if (unique.every((n) => nameToId.has(n.toLowerCase()))) {
      report(reporter, {
        phase: 'lookup',
        message: `Найдено файлов: ${unique.length} из ${unique.length} (кэш).`,
        resolvedCount: unique.length,
        totalCategories: unique.length,
      })
      return { nameToId, warnings }
    }
  }

  const missing = unique.filter((n) => !nameToId.has(n.toLowerCase()))
  if (missing.length > 0) {
    report(reporter, {
      phase: 'lookup',
      message: `Быстрый поиск в Drive: 0 из ${missing.length}…`,
      resolvedCount: 0,
      totalCategories: missing.length,
    })
    const fast = await resolveDriveImageFilesByNames(missing, (resolved, total, currentName) => {
      report(reporter, {
        phase: 'lookup',
        message: `Быстрый поиск: ${currentName} (${resolved}/${total})…`,
        resolvedCount: resolved,
        totalCategories: total,
      })
    })
    warnings.push(...fast.warnings)
    for (const [key, id] of fast.nameToId) {
      nameToId.set(key, id)
    }
  }

  const stillMissing = unique.filter((n) => !nameToId.has(n.toLowerCase()))
  if (stillMissing.length > 0) {
    report(reporter, {
      phase: 'lookup',
      message: `Полный обход Drive для ${stillMissing.length} файл(ов)…`,
      totalCategories: unique.length,
    })
    const files = await listMuruFolderImageFiles({
      logPrefix: '[cover-sync]',
      onWalkProgress: ({ foldersScanned, imagesSeen, queueLength }) => {
        report(reporter, {
          phase: 'lookup',
          message: `Поиск в Drive: обход папок ${foldersScanned}, изображений ${imagesSeen}…`,
          foldersScanned,
          imagesSeen,
          totalCategories: unique.length,
        })
        void queueLength
      },
    })
    setDriveFilenameIndexFromFiles(files)
    const { map: walked, warnings: walkDupes } = buildDriveNameToIdMap(files)
    warnings.push(...walkDupes)
    for (const [key, id] of walked) {
      if (!nameToId.has(key)) nameToId.set(key, id)
    }
  }

  const resolved = unique.filter((n) => nameToId.has(n.toLowerCase())).length
  report(reporter, {
    phase: 'lookup',
    message: `Найдено файлов: ${resolved} из ${unique.length}.`,
    resolvedCount: resolved,
    totalCategories: unique.length,
  })

  return { nameToId, warnings }
}

export const syncCategoryCoversFromDrive = async (
  reporter?: CategoryCoverSyncProgressReporter,
): Promise<CategoryCoverSyncResult> => {
  const categoriesResult = await loadCategoriesWithCovers()
  const rows = categoriesResult.rows

  report(reporter, {
    phase: 'lookup',
    message: `Подготовка: ищем файлы для ${rows.length} категорий в Google Drive…`,
    totalCategories: rows.length,
  })

  const filenames: string[] = []
  for (const row of rows) {
    const validated = validateCoverDriveFilename(row.cover_drive_filename?.trim() ?? '')
    if (validated.ok && validated.value) {
      filenames.push(validated.value)
    }
  }

  const { nameToId, warnings: lookupWarnings } = await buildNameToIdForFilenames(filenames, reporter)
  const drive = createMuruDriveClient()

  const errors: CategoryCoverSyncResult['errors'] = []
  let updated = 0
  let skipped = 0

  report(reporter, {
    phase: 'publish',
    message: `Публикуем ссылки для найденных обложек…`,
    totalCategories: rows.length,
  })

  for (const row of rows) {
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

  report(reporter, {
    phase: 'done',
    message: `Готово: обновлено ${updated} обложек.`,
    resolvedCount: updated,
    totalCategories: rows.length,
  })

  return {
    updated,
    skipped,
    errors,
    ...(lookupWarnings.length > 0 ? { warnings: lookupWarnings } : {}),
  }
}
