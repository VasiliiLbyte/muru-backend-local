import { env } from '../utils/env'

import type { CatalogReadResult } from './google-catalog-rows'
import { readSheetsCatalogWithMeta } from './google-sheets-catalog-reader'
import { readXlsxCatalogWithMeta } from './google-xlsx-catalog-reader'

export type CatalogReadProgressCallback = (message: string) => void

export const readCatalogWithMeta = async (
  onProgress?: CatalogReadProgressCallback,
): Promise<CatalogReadResult> => {
  if (env.catalogSource === 'sheets') {
    onProgress?.('Читаем Google Таблицу…')
    return readSheetsCatalogWithMeta()
  }

  onProgress?.('Читаем реестр товаров (.xlsx)…')
  return readXlsxCatalogWithMeta(onProgress)
}
