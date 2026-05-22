export type DriveImageFormat = 'legacy' | 'cropped'

export type ParsedDriveImage = {
  sku: string
  order: number
  format: DriveImageFormat
}

/** Legacy: MU0001-1.webp / MU0001.webp. Cropped: MU0168_2_O.png */
export const parseDriveImageFilename = (filename: string): ParsedDriveImage | null => {
  const cropped = filename.match(/^(MU\d{4})_(\d+)_O\.(webp|png|jpe?g)$/i)
  if (cropped) {
    return {
      sku: cropped[1].toUpperCase(),
      order: Number(cropped[2]),
      format: 'cropped',
    }
  }

  const legacyWithOrder = filename.match(/^(MU\d{4})-(\d+)\.\w+$/i)
  if (legacyWithOrder) {
    return {
      sku: legacyWithOrder[1].toUpperCase(),
      order: Number(legacyWithOrder[2]),
      format: 'legacy',
    }
  }

  const legacySimple = filename.match(/^(MU\d{4})\.\w+$/i)
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

export type DriveFolderImageKind = 'glavnoe_foto' | 'obrezannye' | 'dop_foto' | 'other'

export const classifyDriveFolder = (folderName: string): DriveFolderImageKind => {
  const n = normalizeDriveFolderName(folderName)
  if (n === 'главное фото' || n === 'глав. фото' || n === 'главноефото') return 'glavnoe_foto'
  if (n === 'обрезанные') return 'obrezannye'
  if (n === 'доп фото' || n === 'доп. фото' || n === 'допфото') return 'dop_foto'
  return 'other'
}

export const acceptsImageInFolder = (
  folderKind: DriveFolderImageKind,
  parsed: ParsedDriveImage,
): boolean => {
  if (parsed.format === 'legacy') return true
  if (folderKind === 'glavnoe_foto') return parsed.order === 1
  if (folderKind === 'obrezannye') return parsed.order === 1
  if (folderKind === 'dop_foto') return parsed.order === 2 || parsed.order === 3
  return false
}
