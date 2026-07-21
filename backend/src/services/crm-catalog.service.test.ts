import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockQuery, mockEnv, mockClientQuery, mockConnect } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockEnv: { catalogSource: 'sheets' as 'sheets' | 'crm' },
  mockClientQuery: vi.fn(),
  mockConnect: vi.fn(),
}))

vi.mock('../utils/env', () => ({
  env: mockEnv,
}))

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
    connect: (...args: unknown[]) => mockConnect(...args),
  },
}))

mockConnect.mockImplementation(async () => ({
  query: (...args: unknown[]) => mockClientQuery(...args),
  release: vi.fn(),
}))

import { CatalogLockedError } from './catalog-source.guard'
import {
  renameCrmSubcategory,
} from './crm-catalog-categories.service'
import { createCrmCharacteristic } from './crm-catalog-characteristics.service'
import {
  createCrmCatalogProduct,
  getCrmCatalogProductById,
  listCrmCatalogProducts,
  updateCrmCatalogProduct,
} from './crm-catalog.service'

const productDetailRow = {
  id: 42,
  sku: 'MU0042',
  name: 'Test',
  description: '',
  price: 100,
  discount_percent: 0,
  in_stock: 1,
  category_id: 3,
  category_name: 'Used',
  category_slug: 'used',
  color: null,
  size: null,
  color_tags: [],
  dimensions_label: '',
  weight_grams: 100,
  dim_length_cm: 10,
  dim_width_cm: 10,
  dim_height_cm: 10,
  dims_source: 'auto',
  weight_source: 'auto',
  image_url_1: null,
  image_url_2: null,
  image_urls: [],
  specs: {},
  web_subcategory_name: 'Bags',
  web_subcategory_slug: 'bags',
  subcategory: 'Bags',
  subcategory_slug: 'bags',
  is_archived: false,
  is_gift_guide: false,
  is_new_arrival: false,
  new_arrival_at: null,
  created_at: new Date(),
  updated_at: new Date(),
}

describe('crm-catalog.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockReset()
    mockClientQuery.mockReset()
    mockConnect.mockReset()
    mockConnect.mockImplementation(async () => ({
      query: (...args: unknown[]) => mockClientQuery(...args),
      release: vi.fn(),
    }))
    mockEnv.catalogSource = 'sheets'
  })

  it('list filters Sale category by virtual discount membership', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    await listCrmCatalogProducts({ category: 'распродажа' })

    const listSql = String(mockQuery.mock.calls[1][0])
    expect(listSql).toContain('p.discount_percent > 0')
    expect(listSql).toContain('p.is_archived = FALSE')
    expect(listSql).not.toContain('c.slug')
  })

  it('list applies archived=false and inStock filters', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    await listCrmCatalogProducts({ inStock: 'in', archived: 'false', q: 'MU' })

    const countSql = String(mockQuery.mock.calls[0][0])
    const countParams = mockQuery.mock.calls[0][1] as unknown[]
    expect(countSql).toContain('p.is_archived = FALSE')
    expect(countSql).toContain('p.in_stock > 0')
    expect(countSql).toContain('p.sku ILIKE')
    expect(countParams[0]).toBe('%MU%')
  })

  it('list applies collectionId EXISTS filter', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    await listCrmCatalogProducts({ collectionId: 5 })

    const countSql = String(mockQuery.mock.calls[0][0])
    const countParams = mockQuery.mock.calls[0][1] as unknown[]
    expect(countSql).toContain('content_collection_products')
    expect(countSql).toContain('ccp.collection_id')
    expect(countParams).toContain(5)
  })

  it('list without collectionId does not join content_collection_products', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    await listCrmCatalogProducts({ archived: 'false' })

    const countSql = String(mockQuery.mock.calls[0][0])
    expect(countSql).not.toContain('content_collection_products')
  })

  it('list applies sortBy=sku&sortDir=asc in ORDER BY', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    await listCrmCatalogProducts({ sortBy: 'sku', sortDir: 'asc' })

    const listSql = String(mockQuery.mock.calls[1][0])
    expect(listSql).toContain('ORDER BY p.sku ASC')
    expect(listSql).toContain('p.sku ASC')
  })

  it('list falls back to updated_at desc for invalid sortBy', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    await listCrmCatalogProducts({ sortBy: 'evil' as never, sortDir: 'asc' })

    const listSql = String(mockQuery.mock.calls[1][0])
    expect(listSql).toContain('ORDER BY p.updated_at DESC')
    expect(listSql).toContain('p.sku ASC')
  })

  it('create throws CatalogLockedError in sheets mode', async () => {
    await expect(
      createCrmCatalogProduct({ sku: 'MU9999', name: 'Test', price: 100 }),
    ).rejects.toBeInstanceOf(CatalogLockedError)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('renameCrmSubcategory updates products in transaction', async () => {
    mockEnv.catalogSource = 'crm'
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] })
      .mockResolvedValueOnce({ rows: [] })

    const result = await renameCrmSubcategory({
      categoryId: 3,
      oldSubcategoryName: 'Old Sub',
      newSubcategoryName: 'New Sub',
    })

    expect(result.updatedCount).toBe(2)
    const updateSql = String(mockClientQuery.mock.calls[1][0])
    expect(updateSql).toContain('web_subcategory_name')
    expect(updateSql).toContain('ILIKE')
  })

  it('createCrmCharacteristic throws on unique violation', async () => {
    mockEnv.catalogSource = 'crm'
    const pgError = Object.assign(new Error('duplicate'), { code: '23505' })
    mockQuery.mockRejectedValueOnce(pgError)

    await expect(createCrmCharacteristic({ name: 'Material' })).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('createCrmCatalogProduct returns 409 when assigning virtual Sale category', async () => {
    mockEnv.catalogSource = 'crm'
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ name: 'Распродажа' }] })

    await expect(
      createCrmCatalogProduct({
        sku: 'MU9999',
        name: 'Test',
        price: 100,
        categoryId: 7,
      }),
    ).rejects.toMatchObject({
      message: 'Cannot assign a product directly to the virtual Sale category',
      statusCode: 409,
    })
    expect(mockQuery).toHaveBeenCalledTimes(2)
  })

  it('updateCrmCatalogProduct returns 409 when assigning virtual Sale category', async () => {
    mockEnv.catalogSource = 'crm'
    mockQuery.mockResolvedValueOnce({ rows: [{ name: 'Распродажа' }] })

    await expect(
      updateCrmCatalogProduct(1, { categoryId: 7 }),
    ).rejects.toMatchObject({
      message: 'Cannot assign a product directly to the virtual Sale category',
      statusCode: 409,
    })
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('createCrmCatalogProduct write-throughs primary subcategory to denorm columns', async () => {
    mockEnv.catalogSource = 'crm'
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 7 }] })
      .mockResolvedValueOnce({ rows: [{ name: 'Bags', slug: 'bags' }] })
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 42 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
    mockQuery
      .mockResolvedValueOnce({ rows: [productDetailRow] })
      .mockResolvedValueOnce({ rows: [{ subcategory_id: 7 }] })

    const product = await createCrmCatalogProduct({
      sku: 'MU0042',
      name: 'Test',
      price: 100,
      subcategoryIds: [7],
    })

    const insertParams = mockClientQuery.mock.calls[1][1] as unknown[]
    expect(insertParams[21]).toBe('Bags')
    expect(insertParams[22]).toBe('bags')
    expect(String(mockClientQuery.mock.calls[2][0])).toContain('DELETE FROM product_subcategories')
    expect(product.subcategoryIds).toEqual([7])
  })

  it('updateCrmCatalogProduct clears denorm when subcategoryIds is empty', async () => {
    mockEnv.catalogSource = 'crm'
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
    mockQuery
      .mockResolvedValueOnce({ rows: [productDetailRow] })
      .mockResolvedValueOnce({ rows: [] })

    await updateCrmCatalogProduct(42, { subcategoryIds: [] })

    const updateParams = mockClientQuery.mock.calls[1][1] as unknown[]
    expect(updateParams[0]).toBeNull()
    expect(updateParams[1]).toBeNull()
    expect(updateParams[2]).toBeNull()
    expect(updateParams[3]).toBeNull()
    expect(String(mockClientQuery.mock.calls[2][0])).toContain('DELETE FROM product_subcategories')
  })

  it('updateCrmCatalogProduct returns 400 for unknown subcategory ids', async () => {
    mockEnv.catalogSource = 'crm'
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 7 }] })

    await expect(updateCrmCatalogProduct(42, { subcategoryIds: [7, 99] })).rejects.toMatchObject({
      message: 'Unknown subcategory id(s): 99',
      statusCode: 400,
    })
  })

  it('getCrmCatalogProductById loads subcategoryIds from junction table', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [productDetailRow] })
      .mockResolvedValueOnce({ rows: [{ subcategory_id: 7 }, { subcategory_id: 9 }] })

    const product = await getCrmCatalogProductById(42)

    expect(product?.subcategoryIds).toEqual([7, 9])
    expect(String(mockQuery.mock.calls[1][0])).toContain('product_subcategories')
  })

  it('list applies giftGuide=true filter', async () => {
    mockEnv.catalogSource = 'crm'
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    await listCrmCatalogProducts({ giftGuide: 'true' })

    const countSql = String(mockQuery.mock.calls[0][0])
    expect(countSql).toContain('p.is_gift_guide = TRUE')
  })

  it('createCrmCatalogProduct writes is_gift_guide when provided', async () => {
    mockEnv.catalogSource = 'crm'
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...productDetailRow, is_gift_guide: true }] })
      .mockResolvedValueOnce({ rows: [] })
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 42 }] })
      .mockResolvedValueOnce({ rows: [] })

    const product = await createCrmCatalogProduct({
      sku: 'MU0042',
      name: 'Test',
      price: 100,
      isGiftGuide: true,
    })

    const insertParams = mockClientQuery.mock.calls[1][1] as unknown[]
    expect(insertParams[25]).toBe(true)
    expect(product.isGiftGuide).toBe(true)
  })

  it('updateCrmCatalogProduct writes is_gift_guide when provided', async () => {
    mockEnv.catalogSource = 'crm'
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] })
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...productDetailRow, is_gift_guide: true }] })
      .mockResolvedValueOnce({ rows: [] })

    await updateCrmCatalogProduct(42, { isGiftGuide: true })

    const updateSql = String(mockClientQuery.mock.calls[1][0])
    expect(updateSql).toContain('is_gift_guide')
  })

  it('list applies newArrival=true filter', async () => {
    mockEnv.catalogSource = 'crm'
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    await listCrmCatalogProducts({ newArrival: 'true' })

    const countSql = String(mockQuery.mock.calls[0][0])
    expect(countSql).toContain('p.is_new_arrival = TRUE')
  })

  it('list applies sortBy=newArrivalAt desc', async () => {
    mockEnv.catalogSource = 'crm'
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    await listCrmCatalogProducts({ sortBy: 'newArrivalAt', sortDir: 'desc' })

    const listSql = String(mockQuery.mock.calls[1][0])
    expect(listSql).toContain('ORDER BY p.new_arrival_at DESC')
  })

  it('update false→true sets new_arrival_at = NOW()', async () => {
    mockEnv.catalogSource = 'crm'
    mockQuery
      .mockResolvedValueOnce({ rows: [{ is_new_arrival: false }] })
      .mockResolvedValueOnce({
        rows: [{ ...productDetailRow, is_new_arrival: true, new_arrival_at: new Date() }],
      })
      .mockResolvedValueOnce({ rows: [] })
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] })

    await updateCrmCatalogProduct(42, { isNewArrival: true })

    const updateSql = String(mockClientQuery.mock.calls[1][0])
    expect(updateSql).toContain('is_new_arrival')
    expect(updateSql).toContain('new_arrival_at = NOW()')
  })

  it('update true→false clears new_arrival_at', async () => {
    mockEnv.catalogSource = 'crm'
    mockQuery
      .mockResolvedValueOnce({ rows: [{ is_new_arrival: true }] })
      .mockResolvedValueOnce({
        rows: [{ ...productDetailRow, is_new_arrival: false, new_arrival_at: null }],
      })
      .mockResolvedValueOnce({ rows: [] })
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] })

    await updateCrmCatalogProduct(42, { isNewArrival: false })

    const updateSql = String(mockClientQuery.mock.calls[1][0])
    expect(updateSql).toContain('is_new_arrival')
    expect(updateSql).toContain('new_arrival_at = NULL')
  })

  it('update true→true does not rewrite new_arrival_at', async () => {
    mockEnv.catalogSource = 'crm'
    mockQuery
      .mockResolvedValueOnce({ rows: [{ is_new_arrival: true }] })
      .mockResolvedValueOnce({
        rows: [{ ...productDetailRow, is_new_arrival: true, new_arrival_at: new Date() }],
      })
      .mockResolvedValueOnce({ rows: [] })
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] })

    await updateCrmCatalogProduct(42, { isNewArrival: true })

    const updateSql = String(mockClientQuery.mock.calls[1][0])
    expect(updateSql).toContain('is_new_arrival')
    expect(updateSql).not.toContain('new_arrival_at')
  })
})
