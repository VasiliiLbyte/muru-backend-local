-- 051: sort_order for top-level categories (mirrors subcategories.sort_order, migration 022)
-- The public catalog tree used to be gated by a hardcoded TOP_LEVEL_CATEGORIES array in code,
-- which also implicitly defined nav order. Now that the tree is built from the categories table
-- directly, ordering needs an explicit column. Backfill preserves the current curated nav order
-- so the live menu does not silently reshuffle to alphabetical on deploy.

ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

UPDATE categories SET sort_order = 0 WHERE name = 'Флористика';
UPDATE categories SET sort_order = 1 WHERE name = 'Натуральный декор';
UPDATE categories SET sort_order = 2 WHERE name = 'Вазы и аксессуары';
UPDATE categories SET sort_order = 3 WHERE name = 'Текстиль';
UPDATE categories SET sort_order = 4 WHERE name = 'Кухня и столовая';
UPDATE categories SET sort_order = 5 WHERE name = 'Интерьер';
UPDATE categories SET sort_order = 6 WHERE name = 'Распродажа';
UPDATE categories SET sort_order = 7 WHERE name = 'Комплексные наборы';

-- Any other existing category (previously hidden by the hardcoded allowlist, e.g.
-- "Постельное белье и пледы") goes after the curated 8, alphabetically, until a manager
-- reorders it via the new admin UI.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn
  FROM categories
  WHERE name NOT IN (
    'Флористика', 'Натуральный декор', 'Вазы и аксессуары', 'Текстиль',
    'Кухня и столовая', 'Интерьер', 'Распродажа', 'Комплексные наборы'
  )
)
UPDATE categories c SET sort_order = 7 + ranked.rn FROM ranked WHERE c.id = ranked.id;
