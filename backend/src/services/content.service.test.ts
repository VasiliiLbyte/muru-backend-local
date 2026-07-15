import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPoolQuery = vi.fn()
const mockConnect = vi.fn()

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockPoolQuery(...args),
    connect: () => mockConnect(),
  },
}))

const mockListPublicHotspotsForLookbook = vi.fn()

vi.mock('./content-hotspots.service', () => ({
  listPublicHotspotsForLookbook: (...args: unknown[]) =>
    mockListPublicHotspotsForLookbook(...args),
}))

import { HttpError } from '../utils/api-response'
import {
  assertSkusExist,
  createLookbook,
  createPage,
  getPublicLookbookBySlug,
  getPublicPageBySlug,
  listPublicBanners,
  setCollectionProducts,
  updateLookbook,
} from './content.service'

describe('content.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListPublicHotspotsForLookbook.mockResolvedValue([])
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

  it('createLookbook persists separate cover and banner images', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          slug: 'spring',
          title: 'Spring',
          description: null,
          cover_image: { url: '/uploads/cover.webp', alt: 'Cover' },
          banner_image: { url: '/uploads/banner.webp', alt: 'Hero' },
          seo_title: '',
          seo_description: '',
          is_visible: true,
          sort_order: 0,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    })

    await createLookbook({
      slug: 'spring',
      title: 'Spring',
      coverImage: { url: '/uploads/cover.webp', alt: 'Cover' },
      bannerImage: { url: '/uploads/banner.webp', alt: 'Hero' },
    })

    const insertCall = mockPoolQuery.mock.calls[0]
    expect(insertCall?.[0]).toContain('banner_image')
    expect(insertCall?.[1]?.[3]).toBe(
      JSON.stringify({ url: '/uploads/cover.webp', alt: 'Cover' }),
    )
    expect(insertCall?.[1]?.[4]).toBe(
      JSON.stringify({ url: '/uploads/banner.webp', alt: 'Hero' }),
    )
  })

  it('updateLookbook persists separate cover and banner images', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            slug: 'spring',
            title: 'Spring',
            description: null,
            cover_image: { url: '/uploads/cover-new.webp', alt: 'Cover' },
            banner_image: { url: '/uploads/banner-new.webp', alt: 'Hero' },
            seo_title: '',
            seo_description: '',
            is_visible: true,
            sort_order: 0,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })

    await updateLookbook(1, {
      slug: 'spring',
      title: 'Spring',
      coverImage: { url: '/uploads/cover-new.webp', alt: 'Cover' },
      bannerImage: { url: '/uploads/banner-new.webp', alt: 'Hero' },
    })

    const updateCall = mockPoolQuery.mock.calls[0]
    expect(updateCall?.[0]).toContain('banner_image = $6')
    expect(updateCall?.[1]?.[4]).toBe(
      JSON.stringify({ url: '/uploads/cover-new.webp', alt: 'Cover' }),
    )
    expect(updateCall?.[1]?.[5]).toBe(
      JSON.stringify({ url: '/uploads/banner-new.webp', alt: 'Hero' }),
    )
  })

  it('getPublicLookbookBySlug returns cover and banner on detail', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            slug: 'spring',
            title: 'Spring',
            description: 'Desc',
            cover_image: { url: '/uploads/cover.webp', alt: 'Cover' },
            banner_image: { url: '/uploads/banner.webp', alt: 'Hero' },
            seo_title: 'Spring SEO',
            seo_description: 'Spring desc',
            is_visible: true,
            sort_order: 0,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })

    const dto = await getPublicLookbookBySlug('spring')

    expect(dto.cover).toEqual({ url: '/uploads/cover.webp', alt: 'Cover' })
    expect(dto.banner).toEqual({ url: '/uploads/banner.webp', alt: 'Hero' })
    expect(mockListPublicHotspotsForLookbook).toHaveBeenCalledWith(1)
  })
})
