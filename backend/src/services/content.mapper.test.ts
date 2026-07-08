import { describe, expect, it } from 'vitest'

import {
  mapCollectionRowToPublic,
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
      seo: { title: 'О нас — MURU', description: 'Описание' },
      updatedAt: '2026-07-08T10:00:00.000Z',
    })
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
})
