import { describe, expect, it } from 'vitest'

import {
  acceptsImageInFolder,
  classifyDriveFolder,
  parseDriveImageFilename,
} from './google-drive-filename'

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
  const legacy2 = { sku: 'MU0001', order: 2, format: 'legacy' as const }

  it('allows order 1 _O in Главное фото and Обрезанные', () => {
    expect(acceptsImageInFolder('glavnoe_foto', cropped1)).toBe(true)
    expect(acceptsImageInFolder('glavnoe_foto', cropped2)).toBe(false)
    expect(acceptsImageInFolder('obrezannye', cropped1)).toBe(true)
    expect(acceptsImageInFolder('obrezannye', cropped2)).toBe(false)
    expect(acceptsImageInFolder('dop_foto', cropped2)).toBe(true)
  })

  it('allows legacy in any folder', () => {
    expect(acceptsImageInFolder('other', legacy2)).toBe(true)
  })
})
