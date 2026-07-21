import { z } from 'zod'

export const imageJsonSchema = z.object({
  url: z.string().min(1),
  alt: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
})

const nullableImageSchema = imageJsonSchema.nullable()

export const companyPromoCardKeySchema = z.enum(['vacancy', 'contacts', 'partners'])

const companyPromoCardSchema = z
  .object({
    key: companyPromoCardKeySchema,
    title: z.string(),
    text: z.string(),
  })
  .strict()

export const companySectionsSchema = z
  .object({
    hero: z
      .object({
        image: nullableImageSchema,
        heading: z.string(),
        text: z.string(),
      })
      .strict(),
    mission: z
      .object({
        label: z.string(),
        heading: z.string(),
        text: z.string(),
        images: z.tuple([nullableImageSchema, nullableImageSchema]),
      })
      .strict(),
    promo: z
      .object({
        image: nullableImageSchema,
        cards: z.array(companyPromoCardSchema).length(3),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const expectedKeys: Array<z.infer<typeof companyPromoCardKeySchema>> = [
      'vacancy',
      'contacts',
      'partners',
    ]
    const actualKeys = value.promo.cards.map((card) => card.key)
    if (actualKeys.join(',') !== expectedKeys.join(',')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'promo.cards keys must be vacancy, contacts, partners in that order',
        path: ['promo', 'cards'],
      })
    }
  })

export const companyPageWriteSchema = z
  .object({
    title: z.string().min(1).optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    isVisible: z.boolean().optional(),
    sections: companySectionsSchema,
  })
  .strict()

export type CompanyPageWriteInput = z.infer<typeof companyPageWriteSchema>

const vacancyItemSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    city: z.string(),
    experience: z.string(),
    format: z.string(),
    salary: z.string(),
    description: z.string(),
  })
  .strict()

export const vacancySectionsSchema = z
  .object({
    hero: z
      .object({
        image: nullableImageSchema,
        heading: z.string(),
        text: z.string(),
      })
      .strict(),
    hr: z
      .object({
        heading: z.string(),
        contactName: z.string(),
        phone: z.string(),
        email: z.string(),
      })
      .strict(),
    vacancies: z
      .object({
        heading: z.string(),
        items: z.array(vacancyItemSchema),
      })
      .strict(),
  })
  .strict()

export const vacancyPageWriteSchema = z
  .object({
    title: z.string().min(1).optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    isVisible: z.boolean().optional(),
    sections: vacancySectionsSchema,
  })
  .strict()

export type VacancyPageWriteInput = z.infer<typeof vacancyPageWriteSchema>

export const pageWriteSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  bodyHtml: z.string(),
  heroImage: imageJsonSchema.nullable().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  isVisible: z.boolean().optional(),
})

export const fixedPageWriteSchema = z.object({
  title: z.string().min(1).optional(),
  bodyHtml: z.string(),
  heroImage: imageJsonSchema.nullable().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  isVisible: z.boolean().optional(),
})

export const collectionWriteSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  heroImage: imageJsonSchema.nullable().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  isVisible: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export const collectionProductsSchema = z.array(
  z.object({
    sku: z.string().min(1),
    sortOrder: z.number().int(),
  }),
)

export const lookbookWriteSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  coverImage: imageJsonSchema.nullable().optional(),
  bannerImage: imageJsonSchema.nullable().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  isVisible: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export const lookbookImagesSchema = z.array(
  z.object({
    image: imageJsonSchema,
    sortOrder: z.number().int(),
  }),
)

export const hotspotWriteSchema = z.object({
  productId: z.number().int().positive(),
  xPercent: z.number().min(0).max(100),
  yPercent: z.number().min(0).max(100),
  sortOrder: z.number().int().optional(),
})

export const hotspotPatchSchema = hotspotWriteSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field required',
  })

export type HotspotWriteInput = z.infer<typeof hotspotWriteSchema>
export type HotspotPatchInput = z.infer<typeof hotspotPatchSchema>

export const bannerWriteSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().nullable().optional(),
  href: z.string().nullable().optional(),
  image: imageJsonSchema.nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
})

export const parseRouteParam = (raw: string | string[] | undefined): string => {
  if (Array.isArray(raw)) return raw[0] ?? ''
  return raw ?? ''
}

export const parsePositiveIntParam = (raw: string | string[] | undefined): number | null => {
  const value = Number(parseRouteParam(raw))
  if (!Number.isInteger(value) || value <= 0) return null
  return value
}
