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

export type PageSections = CompanySections | VacancySections

export type ContentSeo = {
  title: string
  description: string
  ogImage?: string
}

export type StaticPageDto = {
  slug: string
  title: string
  body: string
  heroImage: ContentImage | null
  sections?: PageSections | null
  seo: ContentSeo
  updatedAt?: string
}

export type CollectionDto = {
  id: string
  slug: string
  title: string
  subtitle?: string
  description?: string
  heroImage?: ContentImage
  productSlugs?: string[]
  seo: ContentSeo
  external_id?: string
}

export type LookbookHotspotProductDto = {
  sku: string
  name: string
  price: number
  salePrice?: number
  image?: string
  slug: string
}

export type LookbookHotspotDto = {
  id: string
  xPercent: number
  yPercent: number
  sortOrder: number
  product: LookbookHotspotProductDto
}

export type CrmLookbookHotspotDto = {
  id: string
  lookbookId: string
  productId: number
  xPercent: number
  yPercent: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type LookbookDto = {
  id: string
  slug: string
  title: string
  description?: string
  cover?: ContentImage
  banner?: ContentImage
  images: ContentImage[]
  seo: ContentSeo
  external_id?: string
  hotspots?: LookbookHotspotDto[]
}

export type PublicBannerDto = {
  id: string
  title: string
  subtitle?: string
  href?: string
  image?: ContentImage
  sortOrder: number
}

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
