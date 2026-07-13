import * as XLSX from 'xlsx'

export const buildFixtureBuffer = (): Buffer => {
  const rows = [
    ['Не берем для сайта', 'Ш×В'],
    [
      '№ п/п',
      'Наименование товара',
      'Фото с сайта',
      'Артикул товара для сайта',
      'раздел каталога 1-й уровень',
      'стоимость (без НДС) (руб.)',
      'Фактический остаток',
    ],
    ['1', 'Товар тест', 'MU0099', '', 'Вазы и аксессуары', '1 500,00', '3'],
    ['2', 'Без артикула', '', '', 'Декор', '500', '1'],
  ]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Реестр')
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
}
