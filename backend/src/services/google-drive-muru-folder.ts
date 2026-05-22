import { google } from 'googleapis'

import { env } from '../utils/env'

import { listAllImageFilesInTree } from './google-drive-tree'

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
export const listMuruFolderImageFiles = async (): Promise<Array<{ id: string; name: string }>> => {
  const drive = createMuruDriveClient()
  return listAllImageFilesInTree(drive, env.googleDriveFolderId)
}
