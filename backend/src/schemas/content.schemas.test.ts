import { describe, expect, it } from 'vitest'

import { companySectionsSchema } from './content.schemas'

const validSections = {
  hero: { image: null, heading: 'О нас', text: '<p>Текст</p>' },
  mission: { label: 'Миссия', heading: 'Заголовок', text: '<p>Миссия</p>', images: [null, null] },
  promo: {
    image: null,
    cards: [
      { key: 'vacancy', title: 'Вакансии', text: 'Текст' },
      { key: 'contacts', title: 'Контакты', text: 'Текст' },
      { key: 'partners', title: 'Стать партнёром', text: 'Текст' },
    ],
  },
}

describe('companySectionsSchema', () => {
  it('accepts valid sections shape', () => {
    const result = companySectionsSchema.safeParse(validSections)
    expect(result.success).toBe(true)
  })

  it('rejects extra top-level key (strict)', () => {
    const result = companySectionsSchema.safeParse({
      ...validSections,
      extra: 'field',
    })
    expect(result.success).toBe(false)
  })

  it('rejects wrong cards count', () => {
    const result = companySectionsSchema.safeParse({
      ...validSections,
      promo: {
        image: null,
        cards: [
          { key: 'vacancy', title: 'В', text: '' },
          { key: 'contacts', title: 'К', text: '' },
        ],
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects wrong card key order', () => {
    const result = companySectionsSchema.safeParse({
      ...validSections,
      promo: {
        image: null,
        cards: [
          { key: 'contacts', title: 'К', text: '' },
          { key: 'vacancy', title: 'В', text: '' },
          { key: 'partners', title: 'П', text: '' },
        ],
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid card key', () => {
    const result = companySectionsSchema.safeParse({
      ...validSections,
      promo: {
        image: null,
        cards: [
          { key: 'vacancy', title: 'В', text: '' },
          { key: 'contacts', title: 'К', text: '' },
          { key: 'privacy', title: 'П', text: '' },
        ],
      },
    })
    expect(result.success).toBe(false)
  })
})
