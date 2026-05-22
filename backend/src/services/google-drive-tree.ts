import type { drive_v3 } from 'googleapis'

const FOLDER_MIME = 'application/vnd.google-apps.folder'
const IMAGE_MIME_QUERY =
  "(mimeType='image/webp' or mimeType='image/jpeg' or mimeType='image/png')"

export type DriveListEntry = {
  id: string
  name: string
  mimeType: string
}

const DRIVE_LIST_OPTS = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
} as const

/** Lists immediate children of a folder (paginated). */
export const listFolderChildren = async (
  drive: drive_v3.Drive,
  folderId: string,
): Promise<DriveListEntry[]> => {
  const items: DriveListEntry[] = []
  let pageToken: string | undefined

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 1000,
      pageToken,
      ...DRIVE_LIST_OPTS,
    })
    for (const file of response.data.files ?? []) {
      if (file.id && file.name && file.mimeType) {
        items.push({ id: file.id, name: file.name, mimeType: file.mimeType })
      }
    }
    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return items
}

export const isDriveFolder = (entry: DriveListEntry) => entry.mimeType === FOLDER_MIME

export const isDriveImageFile = (entry: DriveListEntry) =>
  entry.mimeType === 'image/webp' ||
  entry.mimeType === 'image/jpeg' ||
  entry.mimeType === 'image/png'

export type DriveTreeFileHit = {
  fileId: string
  fileName: string
  parentFolderName: string
}

/**
 * BFS from rootFolderId; invokes callback for each image file with parent folder display name.
 */
export const walkDriveImageFiles = async (
  drive: drive_v3.Drive,
  rootFolderId: string,
  onImage: (hit: DriveTreeFileHit) => void | Promise<void>,
): Promise<{ foldersScanned: number; imagesSeen: number }> => {
  const queue: Array<{ id: string; name: string }> = [{ id: rootFolderId, name: '' }]
  let foldersScanned = 0
  let imagesSeen = 0

  while (queue.length > 0) {
    const current = queue.shift()!
    foldersScanned += 1
    const children = await listFolderChildren(drive, current.id)

    for (const child of children) {
      if (isDriveFolder(child)) {
        queue.push({ id: child.id, name: child.name })
        continue
      }
      if (!isDriveImageFile(child)) continue
      imagesSeen += 1
      await onImage({
        fileId: child.id,
        fileName: child.name,
        parentFolderName: current.name,
      })
    }
  }

  return { foldersScanned, imagesSeen }
}

/** BFS; returns every image file (for category cover lookup by exact filename). */
export const listAllImageFilesInTree = async (
  drive: drive_v3.Drive,
  rootFolderId: string,
): Promise<Array<{ id: string; name: string }>> => {
  const files: Array<{ id: string; name: string }> = []
  await walkDriveImageFiles(drive, rootFolderId, async (hit) => {
    files.push({ id: hit.fileId, name: hit.fileName })
  })
  return files
}
