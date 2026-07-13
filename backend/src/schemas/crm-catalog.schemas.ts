import { z } from 'zod'

const dimsFieldsSchema = z.object({
  weightGrams: z.number().int().positive().optional(),
  dimLengthCm: z.number().int().positive().optional(),
  dimWidthCm: z.number().int().positive().optional(),
  dimHeightCm: z.number().int().positive().optional(),
})

export const createCrmCatalogProductSchema = z
  .object({
    sku: z.string().min(1),
    name: z.string().min(1),
    price: z.number().nonnegative(),
    description: z.string().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    inStock: z.number().int().min(0).optional(),
    categoryId: z.number().int().positive().nullable().optional(),
    webSubcategoryName: z.string().nullable().optional(),
    subcategory: z.string().nullable().optional(),
    subcategorySlug: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    size: z.string().nullable().optional(),
    colorTags: z.array(z.string()).optional(),
    dimensionsLabel: z.string().optional(),
    specs: z.record(z.string(), z.string()).optional(),
    imageUrls: z.array(z.string()).optional(),
    imageUrl1: z.string().optional(),
    imageUrl2: z.string().optional(),
    weightGrams: z.number().int().positive().optional(),
    dimLengthCm: z.number().int().positive().optional(),
    dimWidthCm: z.number().int().positive().optional(),
    dimHeightCm: z.number().int().positive().optional(),
  })
  .strict()

export const patchCrmCatalogProductSchema = createCrmCatalogProductSchema
  .omit({ sku: true })
  .partial()
  .strict()

export const crmCatalogStockSchema = z
  .object({
    inStock: z.number().int().min(0),
  })
  .strict()

export type CreateCrmCatalogProductInput = z.infer<typeof createCrmCatalogProductSchema>
export type PatchCrmCatalogProductInput = z.infer<typeof patchCrmCatalogProductSchema>
export type CrmCatalogStockInput = z.infer<typeof crmCatalogStockSchema>

export const hasDimsInput = (
  input: CreateCrmCatalogProductInput | PatchCrmCatalogProductInput,
): boolean =>
  input.weightGrams !== undefined ||
  input.dimLengthCm !== undefined ||
  input.dimWidthCm !== undefined ||
  input.dimHeightCm !== undefined

export const extractDimsInput = (
  input: CreateCrmCatalogProductInput | PatchCrmCatalogProductInput,
) => {
  const parsed = dimsFieldsSchema.safeParse(input)
  if (!parsed.success) return null
  const { weightGrams, dimLengthCm, dimWidthCm, dimHeightCm } = parsed.data
  if (
    weightGrams === undefined ||
    dimLengthCm === undefined ||
    dimWidthCm === undefined ||
    dimHeightCm === undefined
  ) {
    return null
  }
  return { weightGrams, lengthCm: dimLengthCm, widthCm: dimWidthCm, heightCm: dimHeightCm }
}
