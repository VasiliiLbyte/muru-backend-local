-- 048_fix_web_cross_placements.sql
-- Чистка легаси-таблицы product_web_cross_placements (второе «web»-размещение товара).
-- Проблема: строки пишет только старый google-sync; CRM-админка ими НЕ управляет
-- (она пишет product_subcategories + web_subcategory_*), поэтому stale/битые строки
-- невидимы оператору, но тащат товар в чужой листинг.
--
-- Два класса дефектов (по данным на 2026-08-29):
--   (1) self-дубль: товар cross-размещён в СВОЮ ЖЕ основную подкатегорию
--       (напр. 7 подсвечников: primary=podsvechniki, cross=«подсвечники» кириллицей —
--        миграция 032 пропустила этот кириллический slug). Такое размещение бессмысленно.
--   (2) orphan, подтверждённый оператором: MU0295 «Керамический кензан» не должен быть
--       во «Флористический инструмент» (в админке — только «Держатели и кензаны»).
--
-- Идемпотентно (DELETE повторно ничего лишнего не трогает). Осмысленные cross-размещения
-- (салфетки→текстиль, сертификаты→корп.подарки, блюдо→вазы) НЕ затрагиваются.

-- (1) self-дубль: cross указывает на ту же подкатегорию, что и primary товара
--     (по slug ИЛИ по названию — робастно к кириллическим legacy-slug).
DELETE FROM product_web_cross_placements pwcp
USING products p
WHERE pwcp.product_id = p.id
  AND (
    (pwcp.subcategory_slug IS NOT NULL
       AND pwcp.subcategory_slug IN (p.web_subcategory_slug, p.subcategory_slug))
    OR (pwcp.subcategory_name IS NOT NULL
       AND lower(btrim(pwcp.subcategory_name)) IN (
         lower(btrim(coalesce(p.web_subcategory_name, ''))),
         lower(btrim(coalesce(p.subcategory, '')))
       )
       AND btrim(pwcp.subcategory_name) <> '')
  );

-- (2) подтверждённый оператором orphan: MU0295 из «Флористический инструмент».
DELETE FROM product_web_cross_placements pwcp
USING products p
WHERE pwcp.product_id = p.id
  AND p.sku = 'MU0295';
