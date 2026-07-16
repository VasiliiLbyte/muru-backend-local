import { describe, expect, it } from 'vitest'

import {
  mapCollectionRowToPublic,
  mapLookbookRowToCrm,
  mapLookbookRowToPublic,
  mapPageRowToPublic,
  parseImageJson,
} from './content.mapper'

describe('content.mapper', () => {
  it('parseImageJson accepts valid image JSON', () => {
    expect(parseImageJson({ url: 'https://example.com/a.jpg', alt: 'A', width: 100 })).toEqual({
      url: 'https://example.com/a.jpg',
      alt: 'A',
      width: 100,
    })
  })

  it('parseImageJson rejects invalid payloads', () => {
    expect(parseImageJson(null)).toBeUndefined()
    expect(parseImageJson({ alt: 'no url' })).toBeUndefined()
  })

  it('mapPageRowToPublic matches storefront StaticPage shape', () => {
    const dto = mapPageRowToPublic({
      id: 3,
      slug: 'company',
      title: 'О нас',
      body_html: '<p>Text</p>',
      hero_image: null,
      seo_title: 'О нас — MURU',
      seo_description: 'Описание',
      is_visible: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-07-08T10:00:00.000Z',
    })

    expect(dto).toEqual({
      slug: 'company',
      title: 'О нас',
      body: '<p>Text</p>',
      heroImage: null,
      seo: { title: 'О нас — MURU', description: 'Описание' },
      updatedAt: '2026-07-08T10:00:00.000Z',
    })
  })

  it('mapPageRowToPublic includes heroImage when present', () => {
    const dto = mapPageRowToPublic({
      id: 4,
      slug: 'contacts',
      title: 'Контакты',
      body_html: '<p>Shop</p>',
      hero_image: { url: '/uploads/shop.jpg', alt: 'Магазин' },
      seo_title: '',
      seo_description: '',
      is_visible: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-07-08T10:00:00.000Z',
    })

    expect(dto.heroImage).toEqual({ url: '/uploads/shop.jpg', alt: 'Магазин' })
  })

  it('mapCollectionRowToPublic includes productSlugs and camelCase fields', () => {
    const dto = mapCollectionRowToPublic(
      {
        id: 5,
        slug: 'leto-v-dome',
        title: 'Лето в доме',
        subtitle: 'Сезон',
        description: '<p>Desc</p>',
        hero_image: { url: '/uploads/hero.jpg', alt: 'Hero' },
        seo_title: 'SEO title',
        seo_description: 'SEO desc',
        is_visible: true,
        sort_order: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      ['MU0001', 'MU0002'],
    )

    expect(dto.id).toBe('5')
    expect(dto.productSlugs).toEqual(['MU0001', 'MU0002'])
    expect(dto.heroImage).toEqual({ url: '/uploads/hero.jpg', alt: 'Hero' })
    expect(dto.seo).toEqual({ title: 'SEO title', description: 'SEO desc' })
  })

  const lookbookRow = {
    id: 7,
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
  }

  it('mapLookbookRowToCrm includes cover and banner images', () => {
    const dto = mapLookbookRowToCrm(lookbookRow, [])

    expect(dto.coverImage).toEqual({ url: '/uploads/cover.webp', alt: 'Cover' })
    expect(dto.bannerImage).toEqual({ url: '/uploads/banner.webp', alt: 'Hero' })
  })

  it('mapLookbookRowToPublic includes cover only by default', () => {
    const dto = mapLookbookRowToPublic(lookbookRow, [])

    expect(dto.cover).toEqual({ url: '/uploads/cover.webp', alt: 'Cover' })
    expect(dto.banner).toBeUndefined()
  })

  it('mapLookbookRowToPublic includes banner when includeBanner is true', () => {
    const dto = mapLookbookRowToPublic(lookbookRow, [], { includeBanner: true })

    expect(dto.cover).toEqual({ url: '/uploads/cover.webp', alt: 'Cover' })
    expect(dto.banner).toEqual({ url: '/uploads/banner.webp', alt: 'Hero' })
  })
})
