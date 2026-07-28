-- Down for 032_catalog_latin_slugs.sql
-- Restores cyrillic slugs from S0 inventory; drops products.slug.

UPDATE categories SET slug = 'вазы-и-аксессуары' WHERE name = 'Вазы и аксессуары';
UPDATE categories SET slug = 'интерьер' WHERE name = 'Интерьер';
UPDATE categories SET slug = 'комплексные-наборы' WHERE name = 'Комплексные наборы';
UPDATE categories SET slug = 'кухня-и-столовая' WHERE name = 'Кухня и столовая';
UPDATE categories SET slug = 'натуральный-декор' WHERE name = 'Натуральный декор';
UPDATE categories SET slug = 'распродажа' WHERE name = 'Распродажа';
UPDATE categories SET slug = 'текстиль' WHERE name = 'Текстиль';
UPDATE categories SET slug = 'флористика' WHERE name = 'Флористика';
UPDATE categories SET slug = 'подарочные-карты' WHERE name = 'Подарочные карты';
UPDATE categories SET slug = 'без-категории' WHERE name = 'Без категории';

UPDATE subcategories s SET slug = 'вазы-и-кувшины'
FROM categories c WHERE s.category_id = c.id AND c.slug = 'вазы-и-аксессуары' AND s.name = 'Вазы и кувшины';
UPDATE subcategories s SET slug = 'держатели-и-кензаны-для-цветов'
FROM categories c WHERE s.category_id = c.id AND c.slug = 'вазы-и-аксессуары' AND s.name = 'Держатели и кензаны для цветов';
UPDATE subcategories s SET slug = 'подсвечники'
FROM categories c WHERE s.category_id = c.id AND c.slug = 'вазы-и-аксессуары' AND s.name = 'Подсвечники';
UPDATE subcategories s SET slug = 'постеры'
FROM categories c WHERE s.category_id = c.id AND c.slug = 'интерьер' AND s.name = 'Постеры';
UPDATE subcategories s SET slug = 'свет'
FROM categories c WHERE s.category_id = c.id AND c.slug = 'интерьер' AND s.name = 'Свет';
UPDATE subcategories s SET slug = 'тест-подкатегория'
FROM categories c WHERE s.category_id = c.id AND c.slug = 'интерьер' AND s.name = 'Тест подкатегория';
UPDATE subcategories s SET slug = 'корпоративные-подарки'
FROM categories c WHERE s.category_id = c.id AND c.slug = 'комплексные-наборы' AND s.name = 'Корпоративные подарки';
UPDATE subcategories s SET slug = 'кухонные-аксессуары'
FROM categories c WHERE s.category_id = c.id AND c.slug = 'кухня-и-столовая' AND s.name = 'Кухонные аксессуары';
UPDATE subcategories s SET slug = 'посуда'
FROM categories c WHERE s.category_id = c.id AND c.slug = 'кухня-и-столовая' AND s.name = 'Посуда';
UPDATE subcategories s SET slug = 'сервировка'
FROM categories c WHERE s.category_id = c.id AND c.slug = 'кухня-и-столовая' AND s.name = 'Сервировка';
UPDATE subcategories s SET slug = 'текстиль-для-кухни-и-столовой'
FROM categories c WHERE s.category_id = c.id AND c.slug = 'кухня-и-столовая' AND s.name = 'Текстиль для кухни и столовой';
UPDATE subcategories s SET slug = 'корзины-и-плетеные-изделия'
FROM categories c WHERE s.category_id = c.id AND c.slug = 'натуральный-декор'
  AND s.name IN ('Корзины и плетеные изделия', 'Корзины и плетёные изделия');
UPDATE subcategories s SET slug = 'свечи'
FROM categories c WHERE s.category_id = c.id AND c.slug = 'натуральный-декор' AND s.name = 'Свечи';
UPDATE subcategories s SET slug = 'сухоцветы'
FROM categories c WHERE s.category_id = c.id AND c.slug = 'натуральный-декор' AND s.name = 'Сухоцветы';
UPDATE subcategories s SET slug = 'ванная-комната'
FROM categories c WHERE s.category_id = c.id AND c.slug = 'текстиль' AND s.name = 'Ванная комната';
UPDATE subcategories s SET slug = 'спальня'
FROM categories c WHERE s.category_id = c.id AND c.slug = 'текстиль' AND s.name = 'Спальня';
UPDATE subcategories s SET slug = 'горшки-и-кашпо'
FROM categories c WHERE s.category_id = c.id AND c.slug = 'флористика' AND s.name = 'Горшки и кашпо';
UPDATE subcategories s SET slug = 'флористический-инструмент'
FROM categories c WHERE s.category_id = c.id AND c.slug = 'флористика' AND s.name = 'Флористический инструмент';

UPDATE products p
SET subcategory_slug = s.slug
FROM subcategories s
WHERE p.category_id = s.category_id
  AND p.subcategory IS NOT NULL
  AND lower(trim(p.subcategory)) = lower(trim(s.name));

UPDATE products p
SET web_subcategory_slug = s.slug
FROM subcategories s
WHERE p.category_id = s.category_id
  AND p.web_subcategory_name IS NOT NULL
  AND lower(trim(p.web_subcategory_name)) = lower(trim(s.name));

UPDATE product_web_cross_placements p
SET subcategory_slug = s.slug
FROM subcategories s
WHERE p.category_id = s.category_id
  AND p.subcategory_name IS NOT NULL
  AND lower(trim(p.subcategory_name)) = lower(trim(s.name));

ALTER TABLE products DROP COLUMN IF EXISTS slug;
