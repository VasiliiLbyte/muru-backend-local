export type ContentImage = {
  url: string
  alt?: string
  width?: number
  height?: number
}

export type CrmPageDto = {
  id: string
  slug: string
  title: string
  bodyHtml: string
  heroImage: ContentImage | null
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

export type FixedPageWriteInput = {
  title?: string
  bodyHtml: string
  heroImage?: ContentImage | null
  seoTitle?: string
  seoDescription?: string
  isVisible?: boolean
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
