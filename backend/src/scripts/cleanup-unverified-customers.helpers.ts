/**
 * Shared SQL / dry-run helpers for cleanup-unverified-customers script.
 * Candidates: email never verified and older than `olderThanDays`.
 */

export const UNVERIFIED_CLEANUP_DEFAULT_DAYS = 14

export const SELECT_UNVERIFIED_CANDIDATES_SQL = `
SELECT id, email, created_at
FROM customers
WHERE email_verified_at IS NULL
  AND created_at < NOW() - ($1::int * INTERVAL '1 day')
ORDER BY id
`

export const DELETE_UNVERIFIED_BY_IDS_SQL = `
DELETE FROM customers
WHERE id = ANY($1::int[])
  AND email_verified_at IS NULL
RETURNING id
`

export type UnverifiedCandidate = {
  id: number
  email: string
  created_at: Date | string
}

export type CleanupArgs = {
  dryRun: boolean
  olderThanDays: number
}

export const parseCleanupArgs = (argv: string[]): CleanupArgs => {
  const apply = argv.includes('--apply')
  const forceDry = argv.includes('--dry-run')
  // Default dry-run; --apply writes; if both flags present, stay dry-run (safe).
  const dryRun = forceDry || !apply
  return { dryRun, olderThanDays: UNVERIFIED_CLEANUP_DEFAULT_DAYS }
}

export type QueryFn = <T = unknown>(
  sql: string,
  params?: unknown[],
) => Promise<{ rows: T[]; rowCount?: number | null }>

export type CleanupReport = {
  candidates: number
  deleted: number
  dryRun: boolean
  rows: UnverifiedCandidate[]
}

/**
 * List candidates and optionally delete. Dry-run never issues DELETE.
 */
export const runUnverifiedCustomerCleanup = async (
  query: QueryFn,
  args: CleanupArgs,
): Promise<CleanupReport> => {
  const listed = await query<UnverifiedCandidate>(SELECT_UNVERIFIED_CANDIDATES_SQL, [
    args.olderThanDays,
  ])
  const rows = listed.rows
  const candidates = rows.length

  if (args.dryRun || candidates === 0) {
    return { candidates, deleted: 0, dryRun: args.dryRun, rows }
  }

  const ids = rows.map((r) => r.id)
  const deletedResult = await query<{ id: number }>(DELETE_UNVERIFIED_BY_IDS_SQL, [ids])
  return {
    candidates,
    deleted: deletedResult.rows.length,
    dryRun: false,
    rows,
  }
}
