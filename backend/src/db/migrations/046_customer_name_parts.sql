-- 046: split customers.full_name into last_name / first_name / middle_name
-- Idempotent: ADD COLUMN IF NOT EXISTS; backfill only when all three parts are empty.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS middle_name TEXT NOT NULL DEFAULT '';

DO $$
DECLARE
  r RECORD;
  tokens TEXT[];
  n INT;
  v_last TEXT;
  v_first TEXT;
  v_middle TEXT;
BEGIN
  FOR r IN
    SELECT id, full_name
    FROM customers
    WHERE last_name = '' AND first_name = '' AND middle_name = ''
  LOOP
    tokens := regexp_split_to_array(trim(both FROM coalesce(r.full_name, '')), '\s+');
    IF cardinality(tokens) = 1 AND tokens[1] = '' THEN
      tokens := ARRAY[]::TEXT[];
    END IF;
    n := cardinality(tokens);

    IF n = 0 THEN
      v_last := '';
      v_first := '';
      v_middle := '';
    ELSIF n = 1 THEN
      v_last := '';
      v_first := tokens[1];
      v_middle := '';
    ELSIF n = 2 THEN
      v_last := tokens[1];
      v_first := tokens[2];
      v_middle := '';
    ELSE
      v_last := tokens[1];
      v_first := tokens[2];
      v_middle := array_to_string(tokens[3:n], ' ');
    END IF;

    UPDATE customers
    SET
      last_name = v_last,
      first_name = v_first,
      middle_name = v_middle,
      full_name = trim(both ' ' FROM concat_ws(' ',
        NULLIF(v_last, ''), NULLIF(v_first, ''), NULLIF(v_middle, '')))
    WHERE id = r.id;
  END LOOP;
END $$;
