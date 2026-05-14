import { google } from 'googleapis'

import { env } from '../utils/env'

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

const IMAGE_MIME_QUERY =
  "(mimeType='image/webp' or mimeType='image/jpeg' or mimeType='image/png')"

/** Lists image files in configured MURU Drive folder (names + ids only). Does not change permissions. */
export const listMuruFolderImageFiles = async (): Promise<Array<{ id: string; name: string }>> => {
  const drive = await createMuruDriveClient()
  const result = await drive.files.list({
    q: `'${env.googleDriveFolderId}' in parents and trashed=false and ${IMAGE_MIME_QUERY}`,
    fields: 'files(id,name)',
    pageSize: 1000,
  })
  const files = result.data.files ?? []
  return files
    .filter((f): f is { id: string; name: string } => Boolean(f.id && f.name))
    .map((f) => ({ id: f.id!, name: f.name! }))
}
