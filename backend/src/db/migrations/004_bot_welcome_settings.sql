CREATE TABLE IF NOT EXISTS bot_welcome_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  welcome_cover_drive_filename TEXT,
  welcome_image_url TEXT
);

INSERT INTO bot_welcome_settings (id, welcome_cover_drive_filename, welcome_image_url)
VALUES (1, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
