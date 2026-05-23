import { env } from '../utils/env'

import type { CatalogReadResult } from './google-catalog-rows'
import { createMuruDriveClient } from './google-drive-muru-folder'
import { parseXlsxBufferToCatalog } from './google-xlsx-parse'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export type XlsxCatalogProgressCallback = (message: string) => void

const downloadXlsxFromDrive = async (fileId: string): Promise<Buffer> => {
  const drive = createMuruDriveClient()
  const meta = await drive.files.get({
    fileId,
    fields: 'mimeType,name,size',
    supportsAllDrives: true,
  })

  const mimeType = meta.data.mimeType ?? ''
  const fileName = meta.data.name ?? fileId
  console.log(`[sync] Drive catalog file: ${fileName} (${mimeType}, ${meta.data.size ?? '?'} bytes)`)

  if (mimeType === XLSX_MIME || fileName.toLowerCase().endsWith('.xlsx')) {
    const response = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' },
    )
    return Buffer.from(response.data as ArrayBuffer)
  }

  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    const response = await drive.files.export(
      { fileId, mimeType: XLSX_MIME },
      { responseType: 'arraybuffer' },
    )
    return Buffer.from(response.data as ArrayBuffer)
  }

  throw new Error(
    `Unsupported catalog file mimeType "${mimeType}". Expected .xlsx on Drive (${XLSX_MIME}).`,
  )
}

export const readXlsxCatalogWithMeta = async (
  onProgress?: XlsxCatalogProgressCallback,
): Promise<CatalogReadResult> => {
  onProgress?.('Скачиваем реестр .xlsx с Google Drive…')

  const buffer = await downloadXlsxFromDrive(env.googleCatalogFileId)
  console.log(`[sync] Downloaded xlsx: ${buffer.length} bytes`)

  const parsed = parseXlsxBufferToCatalog(buffer, env.googleCatalogXlsxSheetName)
  console.log('[sync] Xlsx sheet selected:', parsed.title || '—')
  console.log('[sync] Xlsx rows:', parsed.rows.length)

  onProgress?.(
    parsed.title
      ? `Лист «${parsed.title}»: ${parsed.rows.length} строк`
      : `Реестр: ${parsed.rows.length} строк`,
  )

  return parsed
}
