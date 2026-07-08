import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPoolQuery = vi.fn()
const mockConnect = vi.fn()

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockPoolQuery(...args),
    connect: () => mockConnect(),
  },
}))

import { HttpError } from '../utils/api-response'
import {
  assertSkusExist,
  createPage,
  getPublicPageBySlug,
  listPublicBanners,
  setCollectionProducts,
} from './content.service'

describe('content.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createPage sanitizes bodyHtml before insert', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          slug: 'about',
          title: 'About',
          body_html: '<p>Safe</p>',
          seo_title: '',
          seo_description: '',
          is_visible: true,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    })

    await createPage({
      slug: 'about',
      title: 'About',
      bodyHtml: '<p>Safe</p><script>alert(1)</script>',
    })

    const insertCall = mockPoolQuery.mock.calls[0]
    expect(insertCall?.[0]).toContain('INSERT INTO content_pages')
    expect(insertCall?.[1]?.[2]).not.toContain('<script')
    expect(insertCall?.[1]?.[2]).toContain('<p>Safe</p>')
  })

  it('createPage throws 409 on duplicate slug', async () => {
    mockPoolQuery.mockRejectedValueOnce({ code: '23505' })

    await expect(
      createPage({ slug: 'dup', title: 'Dup', bodyHtml: '<p>x</p>' }),
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT' })
  })

  it('getPublicPageBySlug returns 404 for hidden page', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })

    await expect(getPublicPageBySlug('hidden')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    })
  })

  it('assertSkusExist throws 404 when SKU missing', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ sku: 'MU0001' }] })

    await expect(assertSkusExist(['MU0001', 'MU9999'])).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    })
  })

  it('setCollectionProducts validates SKUs before writing', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })

    await expect(
      setCollectionProducts(1, [{ sku: 'MISSING', sortOrder: 0 }]),
    ).rejects.toBeInstanceOf(HttpError)

    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('listPublicBanners filters by active schedule in SQL', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] })

    await listPublicBanners()

    const sql = String(mockPoolQuery.mock.calls[0]?.[0])
    expect(sql).toContain('is_active = true')
    expect(sql).toContain('starts_at IS NULL OR starts_at <= NOW()')
    expect(sql).toContain('ends_at IS NULL OR ends_at >= NOW()')
    expect(sql).toContain('ORDER BY sort_order')
  })
})
