import * as XLSX from 'xlsx'

import {
  PRODUCT_IMPORT_HEADERS,
  PRODUCT_IMPORT_INSTRUCTION_SHEET,
  PRODUCT_IMPORT_SHEET_NAME,
} from './crm-catalog-product-import.constants'

const EXAMPLE_ROWS: string[][] = [
  [
    'MU9001',
    'Ваза керамическая пример',
    '3 500,00',
    '2,00',
    'белый',
    'H25',
    'Пример описания для импорта',
    'MURU',
    'керамика',
    'Россия',
    '10',
  ],
  [
    'MU9002',
    'Подсвечник пример',
    '1 200,50',
    '5',
    '',
    '',
    '',
    '',
    'металл',
    '',
    '0',
  ],
]

const INSTRUCTION_LINES: string[][] = [
  ['Памятка по импорту товаров MURU'],
  [''],
  ['Обязательные колонки отмечены * : Артикул, Наименование, Стоимость, Остаток.'],
  ['Числа в российском формате: пробелы разрядов, запятая как десятичный знак (например 3 500,00).'],
  ['Остаток — целое число (2,00 → 2). Скидка % — от 0 до 100, необязательна.'],
  ['Цвет и Размер пишутся и в поля товара, и в характеристики.'],
  ['Страна сохраняется как «Страна производитель».'],
  ['Категории, подкатегории, фото, коллекции, вес и габариты задаются в админке после импорта.'],
  ['При создании без габаритов применяются дефолты доставки: 3000 г / 22×12×18 см.'],
  ['Режимы: new — только новые артикулы; upsert — создать или обновить по артикулу.'],
  ['Ошибки по строкам не отменяют валидные строки (частичный импорт).'],
]

export const buildProductImportTemplateBuffer = (): Buffer => {
  const workbook = XLSX.utils.book_new()
  const dataSheet = XLSX.utils.aoa_to_sheet([
    [...PRODUCT_IMPORT_HEADERS],
    ...EXAMPLE_ROWS,
  ])
  XLSX.utils.book_append_sheet(workbook, dataSheet, PRODUCT_IMPORT_SHEET_NAME)

  const instructionSheet = XLSX.utils.aoa_to_sheet(INSTRUCTION_LINES)
  XLSX.utils.book_append_sheet(workbook, instructionSheet, PRODUCT_IMPORT_INSTRUCTION_SHEET)

  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
}

export const getCrmCatalogProductImportTemplate = (): {
  buffer: Buffer
  contentType: string
  filename: string
} => ({
  buffer: buildProductImportTemplateBuffer(),
  contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  filename: 'muru-product-import-template.xlsx',
})
