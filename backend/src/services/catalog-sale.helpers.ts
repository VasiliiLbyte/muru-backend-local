import { SALE_CATEGORY_NAME } from '../constants/catalog-top-level'

import { slugify } from './crm-catalog.helpers'

export const SALE_CATEGORY_SLUG = slugify(SALE_CATEGORY_NAME)

export const isSaleCategoryFilter = (category?: string, categorySlug?: string): boolean =>
  categorySlug === SALE_CATEGORY_SLUG ||
  category?.trim().toLowerCase() === SALE_CATEGORY_NAME.toLowerCase()

/** Active discounted products — virtual Sale membership */
export const SALE_VIRTUAL_PRODUCT_WHERE = 'p.is_archived = FALSE AND p.discount_percent > 0'

export const SALE_VIRTUAL_PRODUCT_COUNT_SQL = `SELECT COUNT(*)::int AS cnt FROM products p WHERE ${SALE_VIRTUAL_PRODUCT_WHERE}`
