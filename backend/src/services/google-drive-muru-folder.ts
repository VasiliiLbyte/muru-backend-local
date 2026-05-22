import { google } from 'googleapis'

import { env } from '../utils/env'

import type { WalkDriveImageFilesOptions } from './google-drive-tree'
import { listAllImageFilesInTree } from './google-drive-tree'

const IMAGE_MIME_QUERY =
  "(mimeType='image/webp' or mimeType='image/jpeg' or mimeType='image/png')"

const escapeDriveQueryValue = (value: string) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

const DRIVE_LIST_OPTS = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
} as const

export const buildDriveThumbnailUrl = (fileId: string) =>
  `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`

export const createMuruDriveClient = () => {
  const auth = new google.auth.JWT({
    email: env.googleServiceAccountEmail,
    key: env.googlePrivateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  return google.drive({ version: 'v3', auth })
}

export const ensureDriveFileIsPublic = async (
  drive: ReturnType<typeof google.drive>,
  fileId: string,
) => {
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      fields: 'id',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Drive permission error'
    if (!message.toLowerCase().includes('already')) {
      console.warn(`[drive] Unable to make file public (${fileId}): ${message}`)
    }
  }
}

/** Lists image files under configured Drive root (recursive). For category cover filename lookup. */
export const listMuruFolderImageFiles = async (
  options?: WalkDriveImageFilesOptions,
): Promise<Array<{ id: string; name: string }>> => {
  const drive = createMuruDriveClient()
  return listAllImageFilesInTree(drive, env.googleDriveFolderId, options)
}

export type ResolveDriveFilesByNamesResult = {
  nameToId: Map<string, string>
  warnings: string[]
}

/**
 * Parallel Drive search by exact filename (faster than full tree walk for few names).
 * Map keys are lowercase filenames.
 */
export const resolveDriveImageFilesByNames = async (
  filenames: string[],
  onResolved?: (resolvedCount: number, total: number, currentName: string) => void,
): Promise<ResolveDriveFilesByNamesResult> => {
  const drive = createMuruDriveClient()
  const unique = [...new Set(filenames.map((n) => n.trim()).filter(Boolean))]
  const nameToId = new Map<string, string>()
  const warnings: string[] = []
  let resolvedCount = 0

  await Promise.all(
    unique.map(async (name) => {
      const escaped = escapeDriveQueryValue(name)
      const response = await drive.files.list({
        q: `name = '${escaped}' and trashed = false and ${IMAGE_MIME_QUERY}`,
        fields: 'files(id, name)',
        pageSize: 10,
        ...DRIVE_LIST_OPTS,
      })
      const files = response.data.files ?? []
      resolvedCount += 1
      onResolved?.(resolvedCount, unique.length, name)

      if (files.length === 0) return

      const key = name.toLowerCase()
      if (files.length > 1) {
        warnings.push(
          `Duplicate Drive file name (case-insensitive): ${name} — using first match.`,
        )
      }
      const first = files.find((f) => f.id && f.name)
      if (first?.id) {
        if (!nameToId.has(key)) {
          nameToId.set(key, first.id)
        }
      }
    }),
  )

  return { nameToId, warnings }
}
