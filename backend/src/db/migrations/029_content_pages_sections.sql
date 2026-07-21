-- 029_content_pages_sections.sql
-- Structured sections JSONB for CMS "О нас" page + seed company/vacancy/partners.

ALTER TABLE content_pages
  ADD COLUMN IF NOT EXISTS sections JSONB;

INSERT INTO content_pages (slug, title, body_html, sections, seo_title, seo_description, is_visible)
VALUES (
  'company',
  'О нас',
  '',
  '{
    "hero": { "image": null, "heading": "О нас", "text": "" },
    "mission": { "label": "Миссия", "heading": "", "text": "", "images": [null, null] },
    "promo": {
      "image": null,
      "cards": [
        { "key": "vacancy", "title": "Вакансии", "text": "" },
        { "key": "contacts", "title": "Контакты", "text": "" },
        { "key": "partners", "title": "Стать партнёром", "text": "" }
      ]
    }
  }'::jsonb,
  '',
  '',
  true
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO content_pages (slug, title, body_html, sections, seo_title, seo_description, is_visible)
VALUES (
  'vacancy',
  'Вакансии',
  '<p>Информация о вакансиях появится здесь.</p>',
  NULL,
  '',
  '',
  true
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO content_pages (slug, title, body_html, sections, seo_title, seo_description, is_visible)
VALUES (
  'partners',
  'Стать партнёром',
  '<p>Информация для партнёров появится здесь.</p>',
  NULL,
  '',
  '',
  true
)
ON CONFLICT (slug) DO NOTHING;
