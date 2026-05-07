import { google } from 'googleapis'

import { env } from '../utils/env'

const createAuth = () =>
  new google.auth.JWT({
    email: env.googleServiceAccountEmail,
    key: env.googlePrivateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

type StockUpdate = { sku: string; quantity: number }

export const decreaseStockInSheets = async (updates: StockUpdate[]): Promise<void> => {
  if (updates.length === 0) return

  const auth = createAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const readResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: env.googleSheetId,
    range: 'Лист1!A1:Z',
  })

  const rows = readResponse.data.values ?? []
  if (rows.length < 2) return

  const header = rows[0].map((cell: string) => String(cell).trim().toLowerCase())
  const skuColIndex = header.findIndex((h: string) => h === 'sku' || h === 'артикул')
  const stockColIndex = header.findIndex((h: string) => h === 'stock' || h === 'наличие')

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
      range: `${colLetter}${sheetRowNumber}`,
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
