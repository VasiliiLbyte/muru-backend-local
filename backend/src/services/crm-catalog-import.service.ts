import { assertCatalogCrmWritable } from './catalog-source.guard'
import { importCatalogProductsFromRows, type CatalogImportResult } from './google-sync'
import { parseXlsxBufferToCatalog } from './google-xlsx-parse'
import { HttpError } from '../utils/api-response'
import { env } from '../utils/env'

export const importCrmCatalogFromBuffer = async (
  buffer: Buffer,
  dryRun: boolean,
): Promise<CatalogImportResult> => {
  assertCatalogCrmWritable()

  const { rows } = parseXlsxBufferToCatalog(buffer, env.googleCatalogXlsxSheetName || '')
  if (rows.length === 0) {
    throw new HttpError(400, 'No catalog rows or missing SKU header', 'VALIDATION')
  }

  return importCatalogProductsFromRows(rows, { dryRun })
}
