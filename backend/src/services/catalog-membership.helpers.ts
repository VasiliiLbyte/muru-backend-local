/** SQL fragment: active product belongs to category by id (direct or via subcategory entity). */
export const productInCategoryByIdSql = (productAlias: string, categoryIdParam: string): string =>
  `(
    ${productAlias}.category_id = ${categoryIdParam}
    OR EXISTS (
      SELECT 1
      FROM product_subcategories ps
      JOIN subcategories s ON s.id = ps.subcategory_id
      WHERE ps.product_id = ${productAlias}.id
        AND s.category_id = ${categoryIdParam}
    )
  )`

/** SQL fragment: category has at least one active product (direct, subcategory link, or cross-placement). */
export const categoryHasActiveProductsSql = (categoryAlias: string): string =>
  `(
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.category_id = ${categoryAlias}.id AND p.is_archived = FALSE
    )
    OR EXISTS (
      SELECT 1
      FROM product_subcategories ps
      JOIN subcategories s ON s.id = ps.subcategory_id
      JOIN products p ON p.id = ps.product_id
      WHERE s.category_id = ${categoryAlias}.id AND p.is_archived = FALSE
    )
    OR EXISTS (
      SELECT 1
      FROM product_web_cross_placements pwcp
      JOIN products p ON p.id = pwcp.product_id AND p.is_archived = FALSE
      WHERE pwcp.category_id = ${categoryAlias}.id
    )
  )`

/** SQL fragment: product appears in category matched by slug param index. */
export const productInCategoryBySlugSql = (productAlias: string, slugParam: string): string =>
  `(
    EXISTS (
      SELECT 1 FROM categories cat_direct
      WHERE cat_direct.id = ${productAlias}.category_id AND cat_direct.slug = ${slugParam}
    )
    OR EXISTS (
      SELECT 1
      FROM product_subcategories ps
      JOIN subcategories s ON s.id = ps.subcategory_id
      JOIN categories cat ON cat.id = s.category_id
      WHERE ps.product_id = ${productAlias}.id AND cat.slug = ${slugParam}
    )
  )`

/** SQL fragment: product appears in category matched by ILIKE name param index. */
export const productInCategoryByNameSql = (productAlias: string, nameParam: string): string =>
  `(
    EXISTS (
      SELECT 1 FROM categories cat_direct
      WHERE cat_direct.id = ${productAlias}.category_id AND cat_direct.name ILIKE ${nameParam}
    )
    OR EXISTS (
      SELECT 1
      FROM product_subcategories ps
      JOIN subcategories s ON s.id = ps.subcategory_id
      JOIN categories cat ON cat.id = s.category_id
      WHERE ps.product_id = ${productAlias}.id AND cat.name ILIKE ${nameParam}
    )
  )`
