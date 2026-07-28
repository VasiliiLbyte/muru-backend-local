-- 032: latin category/subcategory slugs + nullable products.slug
-- Idempotent. Order: apply 032 → backfill product slugs → apply 033.

ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE INDEX IF NOT EXISTS idx_products_slug ON products (slug);

-- Categories (current cyrillic → final latin / muru.ru)
UPDATE categories SET slug = 'vazy-i-aksessuary' WHERE name = 'Вазы и аксессуары' AND slug IS DISTINCT FROM 'vazy-i-aksessuary';
UPDATE categories SET slug = 'interer' WHERE name = 'Интерьер' AND slug IS DISTINCT FROM 'interer';
UPDATE categories SET slug = 'kompleksnye-nabory' WHERE name = 'Комплексные наборы' AND slug IS DISTINCT FROM 'kompleksnye-nabory';
UPDATE categories SET slug = 'kukhnya-i-stolovaya' WHERE name = 'Кухня и столовая' AND slug IS DISTINCT FROM 'kukhnya-i-stolovaya';
UPDATE categories SET slug = 'naturalnyy-dekor' WHERE name = 'Натуральный декор' AND slug IS DISTINCT FROM 'naturalnyy-dekor';
UPDATE categories SET slug = 'rasprodazha' WHERE name = 'Распродажа' AND slug IS DISTINCT FROM 'rasprodazha';
UPDATE categories SET slug = 'tekstil' WHERE name = 'Текстиль' AND slug IS DISTINCT FROM 'tekstil';
UPDATE categories SET slug = 'floristika-dlya-doma' WHERE name = 'Флористика' AND slug IS DISTINCT FROM 'floristika-dlya-doma';
UPDATE categories SET slug = 'podarochnye-karty' WHERE name = 'Подарочные карты' AND slug IS DISTINCT FROM 'podarochnye-karty';
UPDATE categories SET slug = 'bez-kategorii' WHERE name = 'Без категории' AND slug IS DISTINCT FROM 'bez-kategorii';

-- Subcategories: join parent by final latin slug (categories already updated above)
UPDATE subcategories s
SET slug = 'vazy-i-kuvshiny'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'vazy-i-aksessuary' AND s.name = 'Вазы и кувшины'
  AND s.slug IS DISTINCT FROM 'vazy-i-kuvshiny';

UPDATE subcategories s
SET slug = 'derzhateli-i-kenzany-dlya-tsvetov'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'vazy-i-aksessuary' AND s.name = 'Держатели и кензаны для цветов'
  AND s.slug IS DISTINCT FROM 'derzhateli-i-kenzany-dlya-tsvetov';

UPDATE subcategories s
SET slug = 'podsvechniki'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'vazy-i-aksessuary' AND s.name = 'Подсвечники'
  AND s.slug IS DISTINCT FROM 'podsvechniki';

UPDATE subcategories s
SET slug = 'postery'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'interer' AND s.name = 'Постеры'
  AND s.slug IS DISTINCT FROM 'postery';

UPDATE subcategories s
SET slug = 'svet'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'interer' AND s.name = 'Свет'
  AND s.slug IS DISTINCT FROM 'svet';

UPDATE subcategories s
SET slug = 'test-podkategoriya'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'interer' AND s.name = 'Тест подкатегория'
  AND s.slug IS DISTINCT FROM 'test-podkategoriya';

UPDATE subcategories s
SET slug = 'korporativnye-podarki'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'kompleksnye-nabory' AND s.name = 'Корпоративные подарки'
  AND s.slug IS DISTINCT FROM 'korporativnye-podarki';

UPDATE subcategories s
SET slug = 'kukhonnye-aksessuary'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'kukhnya-i-stolovaya' AND s.name = 'Кухонные аксессуары'
  AND s.slug IS DISTINCT FROM 'kukhonnye-aksessuary';

UPDATE subcategories s
SET slug = 'posuda'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'kukhnya-i-stolovaya' AND s.name = 'Посуда'
  AND s.slug IS DISTINCT FROM 'posuda';

UPDATE subcategories s
SET slug = 'servirovka'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'kukhnya-i-stolovaya' AND s.name = 'Сервировка'
  AND s.slug IS DISTINCT FROM 'servirovka';

UPDATE subcategories s
SET slug = 'tekstil-dlya-kukhni-i-stolovoy'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'kukhnya-i-stolovaya' AND s.name = 'Текстиль для кухни и столовой'
  AND s.slug IS DISTINCT FROM 'tekstil-dlya-kukhni-i-stolovoy';

UPDATE subcategories s
SET slug = 'korziny-i-pletenye-izdeliya'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'naturalnyy-dekor' AND s.name = 'Корзины и плетёные изделия'
  AND s.slug IS DISTINCT FROM 'korziny-i-pletenye-izdeliya';

UPDATE subcategories s
SET slug = 'svechi'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'naturalnyy-dekor' AND s.name = 'Свечи'
  AND s.slug IS DISTINCT FROM 'svechi';

UPDATE subcategories s
SET slug = 'sukhotsvety'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'naturalnyy-dekor' AND s.name = 'Сухоцветы'
  AND s.slug IS DISTINCT FROM 'sukhotsvety';

UPDATE subcategories s
SET slug = 'vannaya-komnata'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'tekstil' AND s.name = 'Ванная комната'
  AND s.slug IS DISTINCT FROM 'vannaya-komnata';

UPDATE subcategories s
SET slug = 'spalnya'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'tekstil' AND s.name = 'Спальня'
  AND s.slug IS DISTINCT FROM 'spalnya';

UPDATE subcategories s
SET slug = 'gorshki-i-kashpo'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'floristika-dlya-doma' AND s.name = 'Горшки и кашпо'
  AND s.slug IS DISTINCT FROM 'gorshki-i-kashpo';

UPDATE subcategories s
SET slug = 'floristicheskiy-instrument'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'floristika-dlya-doma' AND s.name = 'Флористический инструмент'
  AND s.slug IS DISTINCT FROM 'floristicheskiy-instrument';

-- Also match subcategory name without ё (плетеные)
UPDATE subcategories s
SET slug = 'korziny-i-pletenye-izdeliya'
FROM categories c
WHERE s.category_id = c.id AND c.slug = 'naturalnyy-dekor'
  AND s.name IN ('Корзины и плетеные изделия', 'Корзины и плетёные изделия')
  AND s.slug IS DISTINCT FROM 'korziny-i-pletenye-izdeliya';

-- Denormalized product subcategory slugs from entity table (join by name + category)
UPDATE products p
SET subcategory_slug = s.slug
FROM subcategories s
WHERE p.category_id = s.category_id
  AND p.subcategory IS NOT NULL
  AND lower(trim(p.subcategory)) = lower(trim(s.name))
  AND p.subcategory_slug IS DISTINCT FROM s.slug;

UPDATE products p
SET web_subcategory_slug = s.slug
FROM subcategories s
WHERE p.category_id = s.category_id
  AND p.web_subcategory_name IS NOT NULL
  AND lower(trim(p.web_subcategory_name)) = lower(trim(s.name))
  AND p.web_subcategory_slug IS DISTINCT FROM s.slug;

-- Via product_subcategories junction (primary position=0 preferred, else any)
UPDATE products p
SET subcategory_slug = s.slug
FROM product_subcategories ps
JOIN subcategories s ON s.id = ps.subcategory_id
WHERE ps.product_id = p.id
  AND ps.position = 0
  AND p.subcategory_slug IS DISTINCT FROM s.slug;

UPDATE products p
SET web_subcategory_slug = s.slug
FROM product_subcategories ps
JOIN subcategories s ON s.id = ps.subcategory_id
WHERE ps.product_id = p.id
  AND ps.position = 0
  AND (p.web_subcategory_slug IS NULL OR p.web_subcategory_slug IS DISTINCT FROM s.slug)
  AND p.web_subcategory_name IS NOT NULL
  AND lower(trim(p.web_subcategory_name)) = lower(trim(s.name));

UPDATE product_web_cross_placements p
SET subcategory_slug = s.slug
FROM subcategories s
WHERE p.category_id = s.category_id
  AND p.subcategory_name IS NOT NULL
  AND lower(trim(p.subcategory_name)) = lower(trim(s.name))
  AND p.subcategory_slug IS DISTINCT FROM s.slug;
