ALTER TABLE products DROP COLUMN IF EXISTS seo_title;
ALTER TABLE products DROP COLUMN IF EXISTS seo_description;
ALTER TABLE products DROP COLUMN IF EXISTS seo_h1;

ALTER TABLE categories DROP COLUMN IF EXISTS seo_title;
ALTER TABLE categories DROP COLUMN IF EXISTS seo_description;
ALTER TABLE categories DROP COLUMN IF EXISTS seo_h1;
ALTER TABLE categories DROP COLUMN IF EXISTS seo_intro_top;
ALTER TABLE categories DROP COLUMN IF EXISTS seo_text_bottom;

ALTER TABLE subcategories DROP COLUMN IF EXISTS seo_title;
ALTER TABLE subcategories DROP COLUMN IF EXISTS seo_description;
ALTER TABLE subcategories DROP COLUMN IF EXISTS seo_h1;
ALTER TABLE subcategories DROP COLUMN IF EXISTS seo_intro_top;
ALTER TABLE subcategories DROP COLUMN IF EXISTS seo_text_bottom;
