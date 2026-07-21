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
  assertFixedPageSlug,
  assertSkusExist,
  createDefaultCompanySections,
  createDefaultVacancySections,
  createLookbook,
  createPage,
  getCrmPageBySlug,
  getPublicLookbookBySlug,
  getPublicPageBySlug,
  listPublicBanners,
  setCollectionProducts,
  updateLookbook,
  updatePage,
  upsertCompanyPage,
  upsertFixedPage,
  upsertVacancyPage,
} from './content.service'

const defaultSections = createDefaultCompanySections()
const defaultVacancySections = createDefaultVacancySections()

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
          hero_image: null,
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
    expect(insertCall?.[0]).toContain('hero_image')
    expect(insertCall?.[1]?.[2]).not.toContain('<script')
    expect(insertCall?.[1]?.[2]).toContain('<p>Safe</p>')
    expect(insertCall?.[1]?.[3]).toBeNull()
  })

  it('createPage persists heroImage JSON', async () => {
    const hero = { url: '/uploads/shop.jpg', alt: 'Магазин' }
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 2,
          slug: 'contacts',
          title: 'Контакты',
          body_html: '<p>x</p>',
          hero_image: hero,
          seo_title: '',
          seo_description: '',
          is_visible: true,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    })

    const page = await createPage({
      slug: 'contacts',
      title: 'Контакты',
      bodyHtml: '<p>x</p>',
      heroImage: hero,
    })

    expect(mockPoolQuery.mock.calls[0]?.[1]?.[3]).toBe(JSON.stringify(hero))
    expect(page.heroImage).toEqual(hero)
  })

  it('updatePage clears heroImage when null', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 2,
          slug: 'contacts',
          title: 'Контакты',
          body_html: '<p>x</p>',
          hero_image: null,
          seo_title: '',
          seo_description: '',
          is_visible: true,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    })

    const page = await updatePage(2, {
      slug: 'contacts',
      title: 'Контакты',
      bodyHtml: '<p>x</p>',
      heroImage: null,
    })

    expect(String(mockPoolQuery.mock.calls[0]?.[0])).toContain('hero_image = $5')
    expect(mockPoolQuery.mock.calls[0]?.[1]?.[4]).toBeNull()
    expect(page.heroImage).toBeNull()
  })

  it('assertFixedPageSlug rejects unknown slug', () => {
    try {
      assertFixedPageSlug('privacy')
      expect.fail('expected throw')
    } catch (err) {
      expect(err).toMatchObject({ status: 400, code: 'VALIDATION' })
    }
  })

  it('assertFixedPageSlug accepts vacancy', () => {
    expect(assertFixedPageSlug('vacancy')).toBe('vacancy')
  })

  it('getCrmPageBySlug returns mapped page for allowlisted slug', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 3,
          slug: 'help',
          title: 'Клиентам',
          body_html: '<p>Help</p>',
          hero_image: null,
          seo_title: '',
          seo_description: '',
          is_visible: true,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    })

    const page = await getCrmPageBySlug('help')
    expect(page.slug).toBe('help')
    expect(page.title).toBe('Клиентам')
  })

  it('upsertFixedPage inserts when row is missing', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            slug: 'contacts',
            title: 'Контакты',
            body_html: '<p>Body</p>',
            hero_image: { url: '/uploads/a.jpg' },
            seo_title: '',
            seo_description: '',
            is_visible: true,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      })

    const page = await upsertFixedPage('contacts', {
      bodyHtml: '<p>Body</p>',
      heroImage: { url: '/uploads/a.jpg' },
    })

    expect(String(mockPoolQuery.mock.calls[1]?.[0])).toContain('INSERT INTO content_pages')
    expect(mockPoolQuery.mock.calls[1]?.[1]?.[0]).toBe('contacts')
    expect(mockPoolQuery.mock.calls[1]?.[1]?.[1]).toBe('Контакты')
    expect(page.heroImage).toEqual({ url: '/uploads/a.jpg' })
  })

  it('upsertFixedPage updates existing row without changing slug', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ id: 10, title: 'Контакты' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            slug: 'contacts',
            title: 'Новый заголовок',
            body_html: '<p>Updated</p>',
            hero_image: null,
            seo_title: '',
            seo_description: '',
            is_visible: true,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      })

    const page = await upsertFixedPage('contacts', {
      title: 'Новый заголовок',
      bodyHtml: '<p>Updated</p>',
      heroImage: null,
    })

    expect(String(mockPoolQuery.mock.calls[1]?.[0])).toContain('UPDATE content_pages')
    expect(String(mockPoolQuery.mock.calls[1]?.[0])).not.toContain('slug =')
    expect(page.title).toBe('Новый заголовок')
  })

  it('upsertFixedPage rejects slug outside allowlist', async () => {
    await expect(
      upsertFixedPage('privacy', { bodyHtml: '<p>x</p>' }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION' })
    expect(mockPoolQuery).not.toHaveBeenCalled()
  })

  it('upsertCompanyPage inserts when row is missing', async () => {
    const inputSections = {
      ...defaultSections,
      hero: { ...defaultSections.hero, text: '<p>Safe</p><script>x</script>' },
    }
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 20,
            slug: 'company',
            title: 'О нас',
            body_html: '',
            hero_image: null,
            sections: {
              ...inputSections,
              hero: { ...inputSections.hero, text: '<p>Safe</p>' },
            },
            seo_title: '',
            seo_description: '',
            is_visible: true,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      })

    const page = await upsertCompanyPage({ sections: inputSections })

    expect(String(mockPoolQuery.mock.calls[1]?.[0])).toContain('INSERT INTO content_pages')
    const sectionsArg = mockPoolQuery.mock.calls[1]?.[1]?.[2] as string
    expect(sectionsArg).toContain('<p>Safe</p>')
    expect(sectionsArg).not.toContain('<script')
    expect(page.slug).toBe('company')
    expect(page.sections?.hero.text).toContain('<p>Safe</p>')
  })

  it('upsertCompanyPage updates existing row', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ id: 20, title: 'О нас' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 20,
            slug: 'company',
            title: 'О нас',
            body_html: '',
            hero_image: null,
            sections: defaultSections,
            seo_title: '',
            seo_description: '',
            is_visible: true,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      })

    await upsertCompanyPage({ sections: defaultSections })

    expect(String(mockPoolQuery.mock.calls[1]?.[0])).toContain('UPDATE content_pages')
    expect(String(mockPoolQuery.mock.calls[1]?.[0])).toContain('sections = $3')
  })

  it('upsertVacancyPage inserts when row is missing', async () => {
    const inputSections = {
      ...defaultVacancySections,
      hero: { ...defaultVacancySections.hero, text: '<p>Safe</p><script>x</script>' },
      vacancies: {
        ...defaultVacancySections.vacancies,
        items: [
          {
            ...defaultVacancySections.vacancies.items[0],
            description: '<p>Job</p><script>y</script>',
          },
        ],
      },
    }
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 21,
            slug: 'vacancy',
            title: 'Вакансии',
            body_html: '',
            hero_image: null,
            sections: {
              ...inputSections,
              hero: { ...inputSections.hero, text: '<p>Safe</p>' },
              vacancies: {
                ...inputSections.vacancies,
                items: [{ ...inputSections.vacancies.items[0], description: '<p>Job</p>' }],
              },
            },
            seo_title: '',
            seo_description: '',
            is_visible: true,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      })

    const page = await upsertVacancyPage({ sections: inputSections })

    expect(String(mockPoolQuery.mock.calls[1]?.[0])).toContain('INSERT INTO content_pages')
    const sectionsArg = mockPoolQuery.mock.calls[1]?.[1]?.[2] as string
    expect(sectionsArg).toContain('<p>Safe</p>')
    expect(sectionsArg).toContain('<p>Job</p>')
    expect(sectionsArg).not.toContain('<script')
    expect(page.slug).toBe('vacancy')
    expect(page.sections && 'hr' in page.sections ? page.sections.hr.heading : null).toBe(
      'Контакты HR',
    )
  })

  it('upsertVacancyPage updates existing row', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ id: 21, title: 'Вакансии' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 21,
            slug: 'vacancy',
            title: 'Вакансии',
            body_html: '',
            hero_image: null,
            sections: defaultVacancySections,
            seo_title: '',
            seo_description: '',
            is_visible: true,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      })

    await upsertVacancyPage({ sections: defaultVacancySections })

    expect(String(mockPoolQuery.mock.calls[1]?.[0])).toContain('UPDATE content_pages')
    expect(String(mockPoolQuery.mock.calls[1]?.[0])).toContain('sections = $3')
  })

  it('upsertFixedPage clears sections for partners on insert', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 22,
            slug: 'partners',
            title: 'Стать партнёром',
            body_html: '<p>P</p>',
            hero_image: null,
            sections: null,
            seo_title: '',
            seo_description: '',
            is_visible: true,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      })

    await upsertFixedPage('partners', { bodyHtml: '<p>P</p>' })

    expect(String(mockPoolQuery.mock.calls[1]?.[0])).toContain('sections')
    expect(String(mockPoolQuery.mock.calls[1]?.[0])).toContain('NULL')
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
