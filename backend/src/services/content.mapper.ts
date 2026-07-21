import type {
  CollectionDto,
  CompanySections,
  ContentImage,
  ContentSeo,
  CrmBannerDto,
  CrmCollectionDto,
  CrmLookbookDto,
  CrmPageDto,
  LookbookDto,
  PageSections,
  PublicBannerDto,
  StaticPageDto,
  VacancyItem,
  VacancySections,
} from '../types/content'

export const parseImageJson = (value: unknown): ContentImage | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const obj = value as Record<string, unknown>
  if (typeof obj.url !== 'string' || obj.url.length === 0) return undefined

  const image: ContentImage = { url: obj.url }
  if (typeof obj.alt === 'string') image.alt = obj.alt
  if (typeof obj.width === 'number' && Number.isInteger(obj.width) && obj.width > 0) {
    image.width = obj.width
  }
  if (typeof obj.height === 'number' && Number.isInteger(obj.height) && obj.height > 0) {
    image.height = obj.height
  }
  return image
}

const parseNullableImage = (value: unknown): ContentImage | null => {
  if (value == null) return null
  return parseImageJson(value) ?? null
}

const isPromoCardKey = (value: unknown): value is CompanySections['promo']['cards'][0]['key'] =>
  value === 'vacancy' || value === 'contacts' || value === 'partners'

export const parseCompanySectionsJson = (value: unknown): CompanySections | null => {
  if (!value || typeof value !== 'object') return null
  const obj = value as Record<string, unknown>

  const hero = obj.hero
  const mission = obj.mission
  const promo = obj.promo
  if (!hero || typeof hero !== 'object' || !mission || typeof mission !== 'object') {
    return null
  }
  if (!promo || typeof promo !== 'object') return null

  const heroObj = hero as Record<string, unknown>
  const missionObj = mission as Record<string, unknown>
  const promoObj = promo as Record<string, unknown>

  if (typeof heroObj.heading !== 'string' || typeof heroObj.text !== 'string') return null
  if (
    typeof missionObj.label !== 'string' ||
    typeof missionObj.heading !== 'string' ||
    typeof missionObj.text !== 'string'
  ) {
    return null
  }

  const missionImages = missionObj.images
  if (!Array.isArray(missionImages) || missionImages.length !== 2) return null

  const cards = promoObj.cards
  if (!Array.isArray(cards) || cards.length !== 3) return null

  const parsedCards = cards.map((card) => {
    if (!card || typeof card !== 'object') return null
    const cardObj = card as Record<string, unknown>
    if (!isPromoCardKey(cardObj.key)) return null
    if (typeof cardObj.title !== 'string' || typeof cardObj.text !== 'string') return null
    return {
      key: cardObj.key,
      title: cardObj.title,
      text: cardObj.text,
    }
  })

  if (parsedCards.length !== 3 || parsedCards.some((card) => card === null)) return null

  const expectedKeys: CompanySections['promo']['cards'][number]['key'][] = [
    'vacancy',
    'contacts',
    'partners',
  ]
  const typedCards = parsedCards as CompanySections['promo']['cards']
  if (typedCards.map((c) => c.key).join(',') !== expectedKeys.join(',')) return null

  return {
    hero: {
      image: parseNullableImage(heroObj.image),
      heading: heroObj.heading,
      text: heroObj.text,
    },
    mission: {
      label: missionObj.label,
      heading: missionObj.heading,
      text: missionObj.text,
      images: [parseNullableImage(missionImages[0]), parseNullableImage(missionImages[1])],
    },
    promo: {
      image: parseNullableImage(promoObj.image),
      cards: typedCards,
    },
  }
}

const parseVacancyItem = (value: unknown): VacancyItem | null => {
  if (!value || typeof value !== 'object') return null
  const obj = value as Record<string, unknown>
  if (typeof obj.id !== 'string' || obj.id.length === 0) return null
  if (typeof obj.title !== 'string') return null
  if (typeof obj.city !== 'string') return null
  if (typeof obj.experience !== 'string') return null
  if (typeof obj.format !== 'string') return null
  if (typeof obj.salary !== 'string') return null
  if (typeof obj.description !== 'string') return null
  return {
    id: obj.id,
    title: obj.title,
    city: obj.city,
    experience: obj.experience,
    format: obj.format,
    salary: obj.salary,
    description: obj.description,
  }
}

export const parseVacancySectionsJson = (value: unknown): VacancySections | null => {
  if (!value || typeof value !== 'object') return null
  const obj = value as Record<string, unknown>

  const hero = obj.hero
  const hr = obj.hr
  const vacancies = obj.vacancies
  if (!hero || typeof hero !== 'object') return null
  if (!hr || typeof hr !== 'object') return null
  if (!vacancies || typeof vacancies !== 'object') return null

  const heroObj = hero as Record<string, unknown>
  const hrObj = hr as Record<string, unknown>
  const vacanciesObj = vacancies as Record<string, unknown>

  if (typeof heroObj.heading !== 'string' || typeof heroObj.text !== 'string') return null
  if (
    typeof hrObj.heading !== 'string' ||
    typeof hrObj.contactName !== 'string' ||
    typeof hrObj.phone !== 'string' ||
    typeof hrObj.email !== 'string'
  ) {
    return null
  }
  if (typeof vacanciesObj.heading !== 'string') return null
  if (!Array.isArray(vacanciesObj.items)) return null

  const items: VacancyItem[] = []
  for (const raw of vacanciesObj.items) {
    const item = parseVacancyItem(raw)
    if (!item) return null
    items.push(item)
  }

  return {
    hero: {
      image: parseNullableImage(heroObj.image),
      heading: heroObj.heading,
      text: heroObj.text,
    },
    hr: {
      heading: hrObj.heading,
      contactName: hrObj.contactName,
      phone: hrObj.phone,
      email: hrObj.email,
    },
    vacancies: {
      heading: vacanciesObj.heading,
      items,
    },
  }
}

export const parseSectionsJson = (value: unknown): PageSections | null =>
  parseCompanySectionsJson(value) ?? parseVacancySectionsJson(value)

export const toIsoString = (value: Date | string | null | undefined): string | undefined => {
  if (value == null) return undefined
  if (value instanceof Date) return value.toISOString()
  return new Date(value).toISOString()
}

export const mapSeo = (title: string, description: string): ContentSeo => ({
  title,
  description,
})

type PageRow = {
  id: number
  slug: string
  title: string
  body_html: string
  hero_image: unknown
  sections?: unknown
  seo_title: string
  seo_description: string
  is_visible: boolean
  created_at: Date | string
  updated_at: Date | string
}

export const mapPageRowToCrm = (row: PageRow): CrmPageDto => {
  const sections = parseSectionsJson(row.sections)
  const dto: CrmPageDto = {
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    bodyHtml: row.body_html,
    heroImage: parseImageJson(row.hero_image) ?? null,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    isVisible: row.is_visible,
    createdAt: toIsoString(row.created_at) ?? '',
    updatedAt: toIsoString(row.updated_at) ?? '',
  }
  if (sections) dto.sections = sections
  return dto
}

export const mapPageRowToPublic = (row: PageRow): StaticPageDto => {
  const sections = parseSectionsJson(row.sections)
  const dto: StaticPageDto = {
    slug: row.slug,
    title: row.title,
    body: row.body_html,
    heroImage: parseImageJson(row.hero_image) ?? null,
    seo: mapSeo(row.seo_title, row.seo_description),
    updatedAt: toIsoString(row.updated_at),
  }
  if (sections) dto.sections = sections
  return dto
}

type CollectionRow = {
  id: number
  slug: string
  title: string
  subtitle: string | null
  description: string | null
  hero_image: unknown
  seo_title: string
  seo_description: string
  is_visible: boolean
  sort_order: number
  created_at: Date | string
  updated_at: Date | string
}

export const mapCollectionRowToCrm = (
  row: CollectionRow,
  productSlugs: string[],
): CrmCollectionDto => ({
  id: String(row.id),
  slug: row.slug,
  title: row.title,
  subtitle: row.subtitle,
  description: row.description,
  heroImage: parseImageJson(row.hero_image) ?? null,
  productSlugs,
  seoTitle: row.seo_title,
  seoDescription: row.seo_description,
  isVisible: row.is_visible,
  sortOrder: row.sort_order,
  createdAt: toIsoString(row.created_at) ?? '',
  updatedAt: toIsoString(row.updated_at) ?? '',
})

export const mapCollectionRowToPublic = (
  row: CollectionRow,
  productSlugs: string[],
): CollectionDto => {
  const dto: CollectionDto = {
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    seo: mapSeo(row.seo_title, row.seo_description),
    productSlugs,
  }

  if (row.subtitle) dto.subtitle = row.subtitle
  if (row.description) dto.description = row.description
  const heroImage = parseImageJson(row.hero_image)
  if (heroImage) dto.heroImage = heroImage

  return dto
}

type LookbookRow = {
  id: number
  slug: string
  title: string
  description: string | null
  cover_image: unknown
  banner_image?: unknown
  seo_title: string
  seo_description: string
  is_visible: boolean
  sort_order: number
  created_at: Date | string
  updated_at: Date | string
}

export const mapLookbookRowToCrm = (
  row: LookbookRow,
  images: ContentImage[],
): CrmLookbookDto => ({
  id: String(row.id),
  slug: row.slug,
  title: row.title,
  description: row.description,
  coverImage: parseImageJson(row.cover_image) ?? null,
  bannerImage: parseImageJson(row.banner_image) ?? null,
  images,
  seoTitle: row.seo_title,
  seoDescription: row.seo_description,
  isVisible: row.is_visible,
  sortOrder: row.sort_order,
  createdAt: toIsoString(row.created_at) ?? '',
  updatedAt: toIsoString(row.updated_at) ?? '',
})

export const mapLookbookRowToPublic = (
  row: LookbookRow,
  images: ContentImage[],
  options?: { includeBanner?: boolean },
): LookbookDto => {
  const dto: LookbookDto = {
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    images,
    seo: mapSeo(row.seo_title, row.seo_description),
  }

  if (row.description) dto.description = row.description
  const cover = parseImageJson(row.cover_image)
  if (cover) dto.cover = cover
  if (options?.includeBanner) {
    const banner = parseImageJson(row.banner_image)
    if (banner) dto.banner = banner
  }

  return dto
}

type BannerRow = {
  id: number
  title: string
  subtitle: string | null
  href: string | null
  image: unknown
  sort_order: number
  is_active: boolean
  starts_at: Date | string | null
  ends_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

export const mapBannerRowToCrm = (row: BannerRow): CrmBannerDto => ({
  id: String(row.id),
  title: row.title,
  subtitle: row.subtitle,
  href: row.href,
  image: parseImageJson(row.image) ?? null,
  sortOrder: row.sort_order,
  isActive: row.is_active,
  startsAt: toIsoString(row.starts_at) ?? null,
  endsAt: toIsoString(row.ends_at) ?? null,
  createdAt: toIsoString(row.created_at) ?? '',
  updatedAt: toIsoString(row.updated_at) ?? '',
})

export const mapBannerRowToPublic = (row: BannerRow): PublicBannerDto => {
  const dto: PublicBannerDto = {
    id: String(row.id),
    title: row.title,
    sortOrder: row.sort_order,
  }

  if (row.subtitle) dto.subtitle = row.subtitle
  if (row.href) dto.href = row.href
  const image = parseImageJson(row.image)
  if (image) dto.image = image

  return dto
}
