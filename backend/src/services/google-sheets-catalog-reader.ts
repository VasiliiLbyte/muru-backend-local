import { google } from 'googleapis'

import { env } from '../utils/env'

import { matrixToCatalogRows, type CatalogReadResult } from './google-catalog-rows'
import { SHEET_VALUE_RANGE } from './google-sheet-headers'

const createSheetsAuth = () =>
  new google.auth.JWT({
    email: env.googleServiceAccountEmail,
    key: env.googlePrivateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

export const readSheetsCatalogWithMeta = async (): Promise<CatalogReadResult> => {
  const auth = createSheetsAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: env.googleSheetId,
    fields: 'sheets(properties(title))',
  })
  const titles =
    metadata.data.sheets
      ?.map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title)) ?? []

  const orderedTitles = ['Лист1', ...titles.filter((title) => title !== 'Лист1')]

  for (const title of orderedTitles) {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: env.googleSheetId,
      range: `${title}!${SHEET_VALUE_RANGE}`,
    })
    const matrix = (response.data.values ?? []).map((row) =>
      row.map((cell) => String(cell ?? '')),
    )
    const parsed = matrixToCatalogRows(matrix, title)
    if (parsed) {
      console.log('[sync] Google Sheet selected:', parsed.title)
      console.log('[sync] Sheet rows:', parsed.rows.length)
      return parsed
    }
  }

  return { title: '', rows: [] }
}
