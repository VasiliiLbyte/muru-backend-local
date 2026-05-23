import { z } from 'zod'

import { pool } from '../utils/db'

import { validateCoverDriveFilename } from './category-cover-filename'
import {
  buildDriveThumbnailUrl,
  createMuruDriveClient,
  ensureDriveFileIsPublic,
  resolveDriveImageFilesByNames,
} from './google-drive-muru-folder'

const SETTINGS_ID = 1

export type BotWelcomeSettings = {
  welcomeCoverDriveFilename: string | null
  welcomeImageUrl: string | null
}

const rowToSettings = (row: {
  welcome_cover_drive_filename: string | null
  welcome_image_url: string | null
}): BotWelcomeSettings => ({
  welcomeCoverDriveFilename: row.welcome_cover_drive_filename,
  welcomeImageUrl: row.welcome_image_url,
})

export const getBotWelcomeSettings = async (): Promise<BotWelcomeSettings> => {
  const result = await pool.query<{
    welcome_cover_drive_filename: string | null
    welcome_image_url: string | null
  }>(
    `SELECT welcome_cover_drive_filename, welcome_image_url
     FROM bot_welcome_settings WHERE id = $1`,
    [SETTINGS_ID],
  )
  const row = result.rows[0]
  if (!row) {
    return { welcomeCoverDriveFilename: null, welcomeImageUrl: null }
  }
  return rowToSettings(row)
}

const resolveWelcomeImageUrl = async (filename: string): Promise<string | null> => {
  const { nameToId, warnings } = await resolveDriveImageFilesByNames([filename])
  if (warnings.length > 0) {
    console.warn('[bot-welcome] drive resolve warnings:', warnings.join('; '))
  }
  const fileId = nameToId.get(filename.toLowerCase())
  if (!fileId) return null

  const drive = createMuruDriveClient()
  await ensureDriveFileIsPublic(drive, fileId)
  return buildDriveThumbnailUrl(fileId)
}

const updateBodySchema = z.object({
  welcomeCoverDriveFilename: z.union([z.string(), z.null()]).optional(),
})

export type UpdateBotWelcomeResult = {
  settings: BotWelcomeSettings
  validationError: string | null
  resolveWarning: string | null
}

export const updateBotWelcomeCoverFilename = async (body: unknown): Promise<UpdateBotWelcomeResult> => {
  const parsed = updateBodySchema.safeParse(body)
  if (!parsed.success) {
    return {
      settings: await getBotWelcomeSettings(),
      validationError: parsed.error.message,
      resolveWarning: null,
    }
  }

  const validated = validateCoverDriveFilename(parsed.data.welcomeCoverDriveFilename ?? null)
  if (!validated.ok) {
    return {
      settings: await getBotWelcomeSettings(),
      validationError: validated.message,
      resolveWarning: null,
    }
  }

  const filename = validated.value
  let imageUrl: string | null = null
  let resolveWarning: string | null = null

  if (filename) {
    imageUrl = await resolveWelcomeImageUrl(filename)
    if (!imageUrl) {
      resolveWarning = `Файл «${filename}» не найден в Google Drive — URL не обновлён.`
    }
  }

  await pool.query(
    `UPDATE bot_welcome_settings
     SET welcome_cover_drive_filename = $1, welcome_image_url = $2
     WHERE id = $3`,
    [filename, imageUrl, SETTINGS_ID],
  )

  return {
    settings: {
      welcomeCoverDriveFilename: filename,
      welcomeImageUrl: imageUrl,
    },
    validationError: null,
    resolveWarning,
  }
}
