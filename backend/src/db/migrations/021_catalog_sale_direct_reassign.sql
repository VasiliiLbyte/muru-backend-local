-- 021_catalog_sale_direct_reassign.sql
-- Move products with direct Sale category membership to "Без категории"; clear Sale cross-placements.

DO $$
DECLARE
  sale_id INT;
  uncategorized_id INT;
  rec RECORD;
  updated_count INT;
  deleted_cross_count INT;
BEGIN
  SELECT id INTO sale_id FROM categories WHERE name = 'Распродажа';
  IF sale_id IS NULL THEN
    RAISE EXCEPTION 'Category "Распродажа" not found';
  END IF;

  SELECT id INTO uncategorized_id FROM categories WHERE name = 'Без категории';
  IF uncategorized_id IS NULL THEN
    RAISE EXCEPTION 'Category "Без категории" not found';
  END IF;

  FOR rec IN
    SELECT p.sku
    FROM products p
    WHERE p.category_id = sale_id
    ORDER BY p.sku
  LOOP
    RAISE NOTICE 'Reassigning product sku=% from Sale to Без категории', rec.sku;
  END LOOP;

  UPDATE products
  SET category_id = uncategorized_id,
      updated_at = NOW()
  WHERE category_id = sale_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % product(s) from Sale category', updated_count;

  DELETE FROM product_web_cross_placements
  WHERE category_id = sale_id;
  GET DIAGNOSTICS deleted_cross_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % Sale cross-placement row(s)', deleted_cross_count;
END $$;
