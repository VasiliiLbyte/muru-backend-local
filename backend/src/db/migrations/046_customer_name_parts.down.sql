-- 046 down: drop name-part columns; full_name retained as-is.

ALTER TABLE customers DROP COLUMN IF EXISTS last_name;
ALTER TABLE customers DROP COLUMN IF EXISTS first_name;
ALTER TABLE customers DROP COLUMN IF EXISTS middle_name;
