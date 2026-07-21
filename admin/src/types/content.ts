export type ContentImage = {
  url: string
  alt?: string
  width?: number
  height?: number
}

export type CompanyPromoCardKey = 'vacancy' | 'contacts' | 'partners'

export type CompanyPromoCard = {
  key: CompanyPromoCardKey
  title: string
  text: string
}

export type CompanySections = {
  hero: {
    image: ContentImage | null
    heading: string
    text: string
  }
  mission: {
    label: string
    heading: string
    text: string
    images: [ContentImage | null, ContentImage | null]
  }
  promo: {
    image: ContentImage | null
    cards: [CompanyPromoCard, CompanyPromoCard, CompanyPromoCard]
  }
}

export const createDefaultCompanySections = (): CompanySections => ({
  hero: { image: null, heading: 'О нас', text: '' },
  mission: { label: 'Миссия', heading: '', text: '', images: [null, null] },
  promo: {
    image: null,
    cards: [
      { key: 'vacancy', title: 'Вакансии', text: '' },
      { key: 'contacts', title: 'Контакты', text: '' },
      { key: 'partners', title: 'Стать партнёром', text: '' },
    ],
  },
})

export type VacancyItem = {
  id: string
  title: string
  city: string
  experience: string
  format: string
  salary: string
  description: string
}

export type VacancySections = {
  hero: {
    image: ContentImage | null
    heading: string
    text: string
  }
  hr: {
    heading: string
    contactName: string
    phone: string
    email: string
  }
  vacancies: {
    heading: string
    items: VacancyItem[]
  }
}

export type PageSections = CompanySections | VacancySections | PartnersSections

export const createDefaultVacancySections = (): VacancySections => ({
  hero: { image: null, heading: 'Вакансии', text: '' },
  hr: { heading: 'Контакты HR', contactName: '', phone: '', email: '' },
  vacancies: {
    heading: 'Открытые вакансии',
    items: [
      {
        id: 'example-1',
        title: 'Пример вакансии',
        city: '',
        experience: '',
        format: '',
        salary: '',
        description: '',
      },
    ],
  },
})

export type PartnersSections = {
  hero: {
    image: ContentImage | null
    heading: string
    text: string
  }
}

export const createDefaultPartnersSections = (): PartnersSections => ({
  hero: { image: null, heading: 'Стать партнёром', text: '' },
})

export type CrmPageDto = {
  id: string
  slug: string
  title: string
  bodyHtml: string
  heroImage: ContentImage | null
  sections?: PageSections | null
  seoTitle: string
  seoDescription: string
  isVisible: boolean
  createdAt: string
  updatedAt: string
}

export type CrmCollectionDto = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  description: string | null
  heroImage: ContentImage | null
  productSlugs: string[]
  seoTitle: string
  seoDescription: string
  isVisible: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type CrmLookbookDto = {
  id: string
  slug: string
  title: string
  description: string | null
  coverImage: ContentImage | null
  bannerImage: ContentImage | null
  images: ContentImage[]
  seoTitle: string
  seoDescription: string
  isVisible: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type CrmBannerDto = {
  id: string
  title: string
  subtitle: string | null
  href: string | null
  image: ContentImage | null
  sortOrder: number
  isActive: boolean
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  updatedAt: string
}

export type FixedPageSlug = 'help' | 'contacts' | 'vacancy' | 'partners'

export type FixedPageWriteInput = {
  title?: string
  bodyHtml: string
  heroImage?: ContentImage | null
  seoTitle?: string
  seoDescription?: string
  isVisible?: boolean
}

export type CompanyPageWriteInput = {
  title?: string
  seoTitle?: string
  seoDescription?: string
  isVisible?: boolean
  sections: CompanySections
}

export type VacancyPageWriteInput = {
  title?: string
  seoTitle?: string
  seoDescription?: string
  isVisible?: boolean
  sections: VacancySections
}

export type PartnersPageWriteInput = {
  title?: string
  seoTitle?: string
  seoDescription?: string
  isVisible?: boolean
  sections: PartnersSections
}

export type PageWriteInput = {
  slug: string
  title: string
  bodyHtml: string
  heroImage?: ContentImage | null
  seoTitle?: string
  seoDescription?: string
  isVisible?: boolean
}

export type CollectionWriteInput = {
  slug: string
  title: string
  subtitle?: string | null
  description?: string | null
  heroImage?: ContentImage | null
  seoTitle?: string
  seoDescription?: string
  isVisible?: boolean
  sortOrder?: number
}

export type LookbookWriteInput = {
  slug: string
  title: string
  description?: string | null
  coverImage?: ContentImage | null
  bannerImage?: ContentImage | null
  seoTitle?: string
  seoDescription?: string
  isVisible?: boolean
  sortOrder?: number
}

export type BannerWriteInput = {
  title: string
  subtitle?: string | null
  href?: string | null
  image?: ContentImage | null
  sortOrder?: number
  isActive?: boolean
  startsAt?: string | null
  endsAt?: string | null
}

export type CollectionProductInput = { sku: string; sortOrder: number }

export type LookbookImageInput = { image: ContentImage; sortOrder: number }

export type CrmLookbookHotspot = {
  id: string
  lookbookId: string
  productId: number
  xPercent: number
  yPercent: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type LookbookHotspotWriteInput = {
  productId: number
  xPercent: number
  yPercent: number
  sortOrder?: number
}

export type LookbookHotspotPatchInput = Partial<LookbookHotspotWriteInput>

export type HotspotRowView = {
  hotspot: CrmLookbookHotspot
  sku?: string
  name?: string
}
