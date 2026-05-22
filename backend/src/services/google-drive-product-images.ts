import type { drive_v3 } from 'googleapis'

import {
  acceptsImageInFolder,
  classifyDriveFolder,
  parseDriveImageFilename,
} from './google-drive-filename'
import { setDriveFilenameIndexFromFiles } from './drive-filename-index-cache'
import { createMuruDriveClient, ensureDriveFileIsPublic } from './google-drive-muru-folder'
import { walkDriveImageFiles } from './google-drive-tree'
import { env } from '../utils/env'

export type DriveImageRef = { order: number; fileId: string }

export const PLACEHOLDER_DRIVE_FILENAME = 'muru_placeholder_600.webp'

const PUBLISH_CONCURRENCY = 12

export type DriveScanProgressCallback = (update: {
  message: string
  foldersScanned?: number
  imagesSeen?: number
}) => void

export type ProductDriveScanResult = {
  bySku: Map<string, DriveImageRef[]>
  placeholderFileId: string | null
  warnings: string[]
  foldersScanned: number
  imagesSeen: number
  imagesMatched: number
}

const addRef = (
  map: Map<string, DriveImageRef[]>,
  sku: string,
  ref: DriveImageRef,
  warnings: string[],
  context: string,
) => {
  const list = map.get(sku) ?? []
  const existing = list.find((r) => r.order === ref.order)
  if (existing) {
    warnings.push(`Duplicate order ${ref.order} for ${sku} (${context}); keeping first file`)
    return
  }
  list.push(ref)
  map.set(sku, list)
}

const collectFileIdsToPublish = (
  bySku: Map<string, DriveImageRef[]>,
  placeholderFileId: string | null,
): string[] => {
  const ids = new Set<string>()
  if (placeholderFileId) ids.add(placeholderFileId)
  for (const refs of bySku.values()) {
    for (const ref of refs) ids.add(ref.fileId)
  }
  return [...ids]
}

const publishDriveFilesBatch = async (drive: drive_v3.Drive, fileIds: string[]) => {
  for (let i = 0; i < fileIds.length; i += PUBLISH_CONCURRENCY) {
    const batch = fileIds.slice(i, i + PUBLISH_CONCURRENCY)
    await Promise.all(batch.map((fileId) => ensureDriveFileIsPublic(drive, fileId)))
  }
}

export const scanProductImagesFromDriveTree = async (
  onProgress?: DriveScanProgressCallback,
): Promise<ProductDriveScanResult> => {
  const drive = createMuruDriveClient()
  const bySku = new Map<string, DriveImageRef[]>()
  const warnings: string[] = []
  let placeholderFileId: string | null = null
  let imagesMatched = 0
  const indexEntries: Array<{ id: string; name: string }> = []

  onProgress?.({ message: 'Сканируем папки Google Drive…' })

  const { foldersScanned, imagesSeen } = await walkDriveImageFiles(
    drive,
    env.googleDriveFolderId,
    async (hit) => {
      indexEntries.push({ id: hit.fileId, name: hit.fileName })
      const lowerName = hit.fileName.toLowerCase()
      if (lowerName === PLACEHOLDER_DRIVE_FILENAME) {
        placeholderFileId = hit.fileId
        return
      }

      const parsed = parseDriveImageFilename(hit.fileName)
      if (!parsed) return

      const folderKind = classifyDriveFolder(hit.parentFolderName)
      if (!acceptsImageInFolder(folderKind, parsed)) return

      imagesMatched += 1
      addRef(
        bySku,
        parsed.sku,
        { order: parsed.order, fileId: hit.fileId },
        warnings,
        `${hit.parentFolderName || 'root'}/${hit.fileName}`,
      )
    },
    {
      onWalkProgress: (stats) => {
        onProgress?.({
          message: `Сканируем Drive: папок ${stats.foldersScanned}, файлов ${stats.imagesSeen}`,
          foldersScanned: stats.foldersScanned,
          imagesSeen: stats.imagesSeen,
        })
      },
    },
  )

  const fileIdsToPublish = collectFileIdsToPublish(bySku, placeholderFileId)
  if (fileIdsToPublish.length > 0) {
    onProgress?.({ message: `Публикуем доступ к ${fileIdsToPublish.length} файлам в Drive…` })
    console.log(`[sync] Drive publish: ${fileIdsToPublish.length} files`)
    await publishDriveFilesBatch(drive, fileIdsToPublish)
  }

  for (const [, refs] of bySku) {
    refs.sort((a, b) => a.order - b.order)
  }

  const withMain = [...bySku.values()].filter((refs) => refs.some((r) => r.order === 1)).length
  const withOnlyExtra = [...bySku.entries()].filter(
    ([, refs]) => !refs.some((r) => r.order === 1) && refs.some((r) => r.order === 3),
  )
  if (withOnlyExtra.length > 0) {
    warnings.push(
      `${withOnlyExtra.length} SKU(s) have slot 3 but no main (_1_O in Главное фото): ${withOnlyExtra
        .slice(0, 5)
        .map(([sku]) => sku)
        .join(', ')}${withOnlyExtra.length > 5 ? '…' : ''}`,
    )
  }

  setDriveFilenameIndexFromFiles(indexEntries)

  console.log(
    `[sync] Drive tree: folders=${foldersScanned}, images=${imagesSeen}, matched=${imagesMatched}, SKUs=${bySku.size}, withMain=${withMain}`,
  )

  return {
    bySku,
    placeholderFileId,
    warnings,
    foldersScanned,
    imagesSeen,
    imagesMatched,
  }
}
