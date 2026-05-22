import {
  acceptsImageInFolder,
  classifyDriveFolder,
  parseDriveImageFilename,
} from './google-drive-filename'
import { createMuruDriveClient, ensureDriveFileIsPublic } from './google-drive-muru-folder'
import { walkDriveImageFiles } from './google-drive-tree'
import { env } from '../utils/env'

export type DriveImageRef = { order: number; fileId: string }

export const PLACEHOLDER_DRIVE_FILENAME = 'muru_placeholder_600.webp'

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

export const scanProductImagesFromDriveTree = async (): Promise<ProductDriveScanResult> => {
  const drive = createMuruDriveClient()
  const bySku = new Map<string, DriveImageRef[]>()
  const warnings: string[] = []
  let placeholderFileId: string | null = null
  let imagesMatched = 0

  const { foldersScanned, imagesSeen } = await walkDriveImageFiles(
    drive,
    env.googleDriveFolderId,
    async (hit) => {
      const lowerName = hit.fileName.toLowerCase()
      if (lowerName === PLACEHOLDER_DRIVE_FILENAME) {
        placeholderFileId = hit.fileId
        await ensureDriveFileIsPublic(drive, hit.fileId)
        return
      }

      const parsed = parseDriveImageFilename(hit.fileName)
      if (!parsed) return

      const folderKind = classifyDriveFolder(hit.parentFolderName)
      if (!acceptsImageInFolder(folderKind, parsed)) return

      await ensureDriveFileIsPublic(drive, hit.fileId)
      imagesMatched += 1
      addRef(
        bySku,
        parsed.sku,
        { order: parsed.order, fileId: hit.fileId },
        warnings,
        `${hit.parentFolderName || 'root'}/${hit.fileName}`,
      )
    },
  )

  for (const [, refs] of bySku) {
    refs.sort((a, b) => a.order - b.order)
  }

  const withMain = [...bySku.values()].filter((refs) => refs.some((r) => r.order === 1)).length
  const withOnlyExtra = [...bySku.entries()].filter(
    ([, refs]) => !refs.some((r) => r.order === 1) && refs.some((r) => r.order === 3),
  )
  if (withOnlyExtra.length > 0) {
    warnings.push(
      `${withOnlyExtra.length} SKU(s) have extra photo slot 3 but no main (_1_O in Обрезанные): ${withOnlyExtra
        .slice(0, 5)
        .map(([sku]) => sku)
        .join(', ')}${withOnlyExtra.length > 5 ? '…' : ''}`,
    )
  }

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
