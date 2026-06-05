import { describe, expect, it } from 'vitest'

import {
  acceptsImageInFolder,
  classifyDriveFolder,
  isIgnoredDriveFolder,
  normalizeDriveImageBasename,
  parseDriveImageFilename,
} from './google-drive-filename'

describe('normalizeDriveImageBasename', () => {
  it('maps Cyrillic О/о in cropped suffix to Latin O', () => {
    expect(normalizeDriveImageBasename('MU0168_1_О.webp')).toBe('MU0168_1_O.webp')
    expect(normalizeDriveImageBasename('MU0168_2_о.png')).toBe('MU0168_2_O.png')
  })

  it('leaves Latin O and legacy names unchanged', () => {
    expect(normalizeDriveImageBasename('MU0168_1_O.webp')).toBe('MU0168_1_O.webp')
    expect(normalizeDriveImageBasename('MU0001-2.webp')).toBe('MU0001-2.webp')
  })
})

describe('parseDriveImageFilename', () => {
  it('parses cropped _O format', () => {
    expect(parseDriveImageFilename('MU0168_2_O.png')).toEqual({
      sku: 'MU0168',
      order: 2,
      format: 'cropped',
    })
    expect(parseDriveImageFilename('mu0168_1_O.webp')).toEqual({
      sku: 'MU0168',
      order: 1,
      format: 'cropped',
    })
  })

  it('parses cropped suffix with Cyrillic О', () => {
    expect(parseDriveImageFilename('MU0168_1_О.webp')).toEqual({
      sku: 'MU0168',
      order: 1,
      format: 'cropped',
    })
    expect(parseDriveImageFilename('MU0168_2_о.png')).toEqual({
      sku: 'MU0168',
      order: 2,
      format: 'cropped',
    })
  })

  it('parses legacy dash format', () => {
    expect(parseDriveImageFilename('MU0001-2.webp')).toEqual({
      sku: 'MU0001',
      order: 2,
      format: 'legacy',
    })
    expect(parseDriveImageFilename('MU0001.webp')).toEqual({
      sku: 'MU0001',
      order: 1,
      format: 'legacy',
    })
  })

  it('rejects unrelated filenames', () => {
    expect(parseDriveImageFilename('cover_floristika.jpg')).toBeNull()
    expect(parseDriveImageFilename('MU0168_2.png')).toBeNull()
    expect(parseDriveImageFilename('ЗАГЛУШКА_O.png')).toBeNull()
  })
})

describe('isIgnoredDriveFolder', () => {
  it('ignores banner/header folders', () => {
    expect(isIgnoredDriveFolder('Заголовки и подзаголовки')).toBe(true)
    expect(isIgnoredDriveFolder('Распродажа')).toBe(false)
    expect(isIgnoredDriveFolder('Фото для выгрузки')).toBe(false)
  })
})

describe('classifyDriveFolder', () => {
  it('recognizes Главное фото, Обрезанные and Доп фото variants', () => {
    expect(classifyDriveFolder('Главное фото')).toBe('glavnoe_foto')
    expect(classifyDriveFolder('Глав. фото')).toBe('glavnoe_foto')
    expect(classifyDriveFolder('Обрезанные')).toBe('obrezannye')
    expect(classifyDriveFolder('Доп фото')).toBe('dop_foto')
    expect(classifyDriveFolder('Доп. фото')).toBe('dop_foto')
    expect(classifyDriveFolder('Вазы и аксессуары')).toBe('other')
  })
})

describe('acceptsImageInFolder', () => {
  const cropped1 = { sku: 'MU0168', order: 1, format: 'cropped' as const }
  const cropped2 = { sku: 'MU0168', order: 2, format: 'cropped' as const }
  const cropped4 = { sku: 'MU0168', order: 4, format: 'cropped' as const }
  const legacy2 = { sku: 'MU0001', order: 2, format: 'legacy' as const }

  it('allows cropped slots 1-3 in any folder kind', () => {
    expect(acceptsImageInFolder('other', cropped1)).toBe(true)
    expect(acceptsImageInFolder('other', cropped2)).toBe(true)
    expect(acceptsImageInFolder('glavnoe_foto', cropped2)).toBe(true)
    expect(acceptsImageInFolder('dop_foto', cropped1)).toBe(true)
    expect(acceptsImageInFolder('other', cropped4)).toBe(false)
  })

  it('allows legacy in any folder', () => {
    expect(acceptsImageInFolder('other', legacy2)).toBe(true)
  })
})
