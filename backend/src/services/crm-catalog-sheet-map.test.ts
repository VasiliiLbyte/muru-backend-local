import { describe, expect, it } from 'vitest'

import { matrixToCatalogRows } from './google-catalog-rows'
import {
  buildExportMatrix,
  sheetRowToExportShape,
  type ExportCatalogRow,
} from './crm-catalog-sheet-map'

describe('crm-catalog-sheet-map', () => {
  it('round-trips export matrix through matrixToCatalogRows', () => {
    const exportRow: ExportCatalogRow = {
      sku: 'MU0099',
      name: 'Товар тест',
      categoryName: 'Вазы и аксессуары',
      webSubcategoryName: 'Вазы',
      crossCategoryName: '',
      crossSubcategoryName: '',
      price: 1500,
      discountPercent: 0,
      inStock: 3,
      description: 'Описание',
      color: 'белый',
      dimensionsLabel: '20×30',
      variantsStr: 'белый|M',
      specs: { Материал: 'керамика' },
      isArchived: false,
    }

    const matrix = buildExportMatrix([exportRow])
    const parsed = matrixToCatalogRows(matrix, 'Реестр')
    expect(parsed).not.toBeNull()
    expect(parsed?.rows).toHaveLength(1)

    const row = parsed!.rows[0]
    const shape = sheetRowToExportShape(row)
    expect(shape.sku).toBe('MU0099')
    expect(shape.name).toBe('Товар тест')
    expect(shape.categoryName).toBe('Вазы и аксессуары')
    expect(shape.webSubcategoryName).toBe('Вазы')
    expect(shape.inStock).toBe(3)
  })
})
