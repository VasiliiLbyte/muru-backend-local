export type ContentImage = {
  url: string
  alt?: string
  width?: number
  height?: number
}

export type ContentSeo = {
  title: string
  description: string
  ogImage?: string
}

export type StaticPageDto = {
  slug: string
  title: string
  body: string
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

export type LookbookDto = {
  id: string
  slug: string
  title: string
  description?: string
  cover?: ContentImage
  images: ContentImage[]
  seo: ContentSeo
  external_id?: string
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
