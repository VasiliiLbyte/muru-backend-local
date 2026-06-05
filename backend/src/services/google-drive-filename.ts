export type DriveImageFormat = 'legacy' | 'cropped'

export type ParsedDriveImage = {
  sku: string
  order: number
  format: DriveImageFormat
}

const MAX_CROPPED_IMAGE_ORDER = 3

/** Maps Cyrillic О/о in cropped suffix to Latin O before parsing. */
export const normalizeDriveImageBasename = (filename: string): string =>
  filename.normalize('NFC').replace(
    /^(MU\d{4})_(\d+)_[OОо]\.(webp|png|jpe?g)$/iu,
    (_, sku, order, ext) => `${sku}_${order}_O.${ext}`,
  )

/** Legacy: MU0001-1.webp / MU0001.webp. Cropped: MU0168_2_O.png (Latin or Cyrillic О). */
export const parseDriveImageFilename = (filename: string): ParsedDriveImage | null => {
  const normalized = normalizeDriveImageBasename(filename)

  const cropped = normalized.match(/^(MU\d{4})_(\d+)_O\.(webp|png|jpe?g)$/i)
  if (cropped) {
    return {
      sku: cropped[1].toUpperCase(),
      order: Number(cropped[2]),
      format: 'cropped',
    }
  }

  const legacyWithOrder = normalized.match(/^(MU\d{4})-(\d+)\.\w+$/i)
  if (legacyWithOrder) {
    return {
      sku: legacyWithOrder[1].toUpperCase(),
      order: Number(legacyWithOrder[2]),
      format: 'legacy',
    }
  }

  const legacySimple = normalized.match(/^(MU\d{4})\.\w+$/i)
  if (legacySimple) {
    return {
      sku: legacySimple[1].toUpperCase(),
      order: 1,
      format: 'legacy',
    }
  }

  return null
}

export const normalizeDriveFolderName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')

const IGNORED_DRIVE_FOLDER_NAMES = new Set([
  normalizeDriveFolderName('Заголовки и подзаголовки'),
])

export const isIgnoredDriveFolder = (folderName: string): boolean =>
  IGNORED_DRIVE_FOLDER_NAMES.has(normalizeDriveFolderName(folderName))

export type DriveFolderImageKind = 'glavnoe_foto' | 'obrezannye' | 'dop_foto' | 'other'

export const classifyDriveFolder = (folderName: string): DriveFolderImageKind => {
  const n = normalizeDriveFolderName(folderName)
  if (n === 'главное фото' || n === 'глав. фото' || n === 'главноефото') return 'glavnoe_foto'
  if (n === 'обрезанные') return 'obrezannye'
  if (n === 'доп фото' || n === 'доп. фото' || n === 'допфото') return 'dop_foto'
  return 'other'
}

export const acceptsImageInFolder = (
  _folderKind: DriveFolderImageKind,
  parsed: ParsedDriveImage,
): boolean => {
  if (parsed.format === 'legacy') return true
  if (parsed.format === 'cropped') {
    return parsed.order >= 1 && parsed.order <= MAX_CROPPED_IMAGE_ORDER
  }
  return false
}
