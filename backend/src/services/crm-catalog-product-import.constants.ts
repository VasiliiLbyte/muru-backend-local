/** Shared column headers for clean product import template (IMPORT-001). */

export const PRODUCT_IMPORT_HEADERS = [
  'Артикул*',
  'Наименование*',
  'Стоимость, ₽*',
  'Остаток*',
  'Цвет',
  'Размер',
  'Описание',
  'Бренд',
  'Материал',
  'Страна',
  'Скидка %',
] as const

export type ProductImportHeader = (typeof PRODUCT_IMPORT_HEADERS)[number]

export const PRODUCT_IMPORT_REQUIRED_HEADERS = [
  'Артикул*',
  'Наименование*',
  'Стоимость, ₽*',
  'Остаток*',
] as const

/** Admin-canon specs keys (dual-write / write path). */
export const SPEC_COLOR = 'Цвет'
export const SPEC_SIZE = 'Размер'
export const SPEC_BRAND = 'Бренд'
export const SPEC_MATERIAL = 'Материал'
export const SPEC_COUNTRY = 'Страна производитель'

export const PRODUCT_IMPORT_SHEET_NAME = 'Товары'
export const PRODUCT_IMPORT_INSTRUCTION_SHEET = 'Инструкция'
