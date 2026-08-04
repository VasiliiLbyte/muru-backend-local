-- 040 down: no-op.
-- Backfill inserts cannot be safely deleted without a from_backfill flag;
-- rolling back would risk removing legitimate CRM-assigned junction rows.
-- Manual cleanup only if needed: remove links that exist solely from denorm
-- and were never intended (operator judgment).
SELECT 1;
