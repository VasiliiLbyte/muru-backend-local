-- 020_catalog_categories_cleanup.sql
-- Remove unused categories that are not canonical top-level names and have no active products or cross-placements.

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT c.id, c.name
    FROM categories c
    WHERE c.name NOT IN (
      'Флористика',
      'Натуральный декор',
      'Вазы и аксессуары',
      'Текстиль',
      'Кухня и столовая',
      'Интерьер',
      'Распродажа',
      'Комплексные наборы',
      'Без категории'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM products p
      WHERE p.category_id = c.id
        AND p.is_archived = FALSE
    )
    AND NOT EXISTS (
      SELECT 1
      FROM product_web_cross_placements pwcp
      INNER JOIN products p ON p.id = pwcp.product_id AND p.is_archived = FALSE
      WHERE pwcp.category_id = c.id
    )
  LOOP
    RAISE NOTICE 'Removing unused category id=% name=%', rec.id, rec.name;
    DELETE FROM categories WHERE id = rec.id;
  END LOOP;
END $$;
