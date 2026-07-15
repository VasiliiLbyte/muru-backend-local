import type {
  CollectionDto,
  ContentImage,
  ContentSeo,
  CrmBannerDto,
  CrmCollectionDto,
  CrmLookbookDto,
  CrmPageDto,
  LookbookDto,
  PublicBannerDto,
  StaticPageDto,
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
  seo_title: string
  seo_description: string
  is_visible: boolean
  created_at: Date | string
  updated_at: Date | string
}

export const mapPageRowToCrm = (row: PageRow): CrmPageDto => ({
  id: String(row.id),
  slug: row.slug,
  title: row.title,
  bodyHtml: row.body_html,
  seoTitle: row.seo_title,
  seoDescription: row.seo_description,
  isVisible: row.is_visible,
  createdAt: toIsoString(row.created_at) ?? '',
  updatedAt: toIsoString(row.updated_at) ?? '',
})

export const mapPageRowToPublic = (row: PageRow): StaticPageDto => ({
  slug: row.slug,
  title: row.title,
  body: row.body_html,
  seo: mapSeo(row.seo_title, row.seo_description),
  updatedAt: toIsoString(row.updated_at),
})

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
