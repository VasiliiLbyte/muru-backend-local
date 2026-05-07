import { google } from 'googleapis'

import { env } from '../utils/env'

const createAuth = () =>
  new google.auth.JWT({
    email: env.googleServiceAccountEmail,
    key: env.googlePrivateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

type StockUpdate = { sku: string; quantity: number }

const normalizeHeaderKey = (value: string) =>
  value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const detectWritableSheet = async (
  sheetsApi: ReturnType<typeof google.sheets>,
): Promise<{ title: string; rows: string[][] } | null> => {
  const metadata = await sheetsApi.spreadsheets.get({
    spreadsheetId: env.googleSheetId,
    fields: 'sheets(properties(title))',
  })
  const titles =
    metadata.data.sheets
      ?.map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title)) ?? []
  const orderedTitles = ['Лист1', ...titles.filter((title) => title !== 'Лист1')]

  for (const title of orderedTitles) {
    const response = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: env.googleSheetId,
      range: `${title}!A1:Z`,
    })
    const rows = response.data.values ?? []
    if (rows.length < 2) continue

    const header = rows[0].map((cell) => normalizeHeaderKey(String(cell ?? '')))
    const hasSku = header.some((h) => h === 'sku' || h.includes('артикул'))
    const hasStock = header.some((h) => h === 'stock' || h === 'наличие')
    if (hasSku && hasStock) return { title, rows }
  }

  return null
}

export const decreaseStockInSheets = async (updates: StockUpdate[]): Promise<void> => {
  if (updates.length === 0) return

  const auth = createAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const detected = await detectWritableSheet(sheets)
  if (!detected) return

  const { title, rows } = detected
  const header = rows[0].map((cell: string) => normalizeHeaderKey(String(cell ?? '')))
  const skuColIndex = header.findIndex(
    (h: string) => h === 'sku' || h === 'артикул' || h === 'артикул товара' || h === 'артикул товара для сайта',
  )
  const stockColIndex = header.findIndex(
    (h: string) => h === 'stock' || h === 'наличие' || h === 'фактический остаток',
  )

  if (skuColIndex === -1 || stockColIndex === -1) {
    console.error('[sheets-write] SKU or stock column not found in sheet')
    return
  }

  const batchData: { range: string; values: (string | number)[][] }[] = []

  for (const update of updates) {
    const sku = update.sku.toUpperCase()
    const rowIndex = rows.findIndex((row: string[], idx: number) => {
      if (idx === 0) return false
      return String(row[skuColIndex] ?? '')
        .trim()
        .toUpperCase() === sku
    })

    if (rowIndex === -1) {
      console.warn(`[sheets-write] SKU ${sku} not found in sheet, skipping`)
      continue
    }

    const currentStock = Number(rows[rowIndex][stockColIndex] ?? 0)
    const newStock = Math.max(0, currentStock - update.quantity)

    const sheetRowNumber = rowIndex + 1
    const colLetter = String.fromCharCode(65 + stockColIndex)
    batchData.push({
      range: `${title}!${colLetter}${sheetRowNumber}`,
      values: [[newStock]],
    })

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[sheets-write] ${sku}: ${currentStock} -> ${newStock}`)
    }
  }

  if (batchData.length === 0) return

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: env.googleSheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: batchData,
    },
  })
}
