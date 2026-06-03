-- New default shipping dims for all products: 3 kg, 22×12×18 cm (L×W×H)
ALTER TABLE products ALTER COLUMN weight_grams SET DEFAULT 3000;
ALTER TABLE products ALTER COLUMN dim_length_cm SET DEFAULT 22;
ALTER TABLE products ALTER COLUMN dim_width_cm SET DEFAULT 12;
ALTER TABLE products ALTER COLUMN dim_height_cm SET DEFAULT 18;

-- Update existing auto-sourced products (skip manager manual overrides)
UPDATE products SET weight_grams = 3000 WHERE weight_source = 'auto';
UPDATE products
SET dim_length_cm = 22, dim_width_cm = 12, dim_height_cm = 18
WHERE dims_source = 'auto';
