/**
 * Delete unverified customer accounts older than 14 days (squatting / abandoned).
 * Child ЛК rows CASCADE; orders.customer_id SET NULL via FK.
 *
 * Usage:
 *   npx tsx src/scripts/cleanup-unverified-customers.ts           # dry-run (default)
 *   npx tsx src/scripts/cleanup-unverified-customers.ts --dry-run
 *   npx tsx src/scripts/cleanup-unverified-customers.ts --apply
 */

import { pool } from '../utils/db'
import {
  parseCleanupArgs,
  runUnverifiedCustomerCleanup,
  type QueryFn,
} from './cleanup-unverified-customers.helpers'

async function main(): Promise<void> {
  const args = parseCleanupArgs(process.argv.slice(2))
  const mode = args.dryRun ? 'DRY-RUN' : 'APPLY'
  console.log(`[cleanup-unverified-customers] mode=${mode} olderThanDays=${args.olderThanDays}`)

  const query: QueryFn = async <T = unknown>(sql: string, params?: unknown[]) => {
    const result = await pool.query(sql, params)
    return { rows: result.rows as T[], rowCount: result.rowCount }
  }

  const report = await runUnverifiedCustomerCleanup(query, args)

  if (args.dryRun) {
    for (const row of report.rows) {
      console.log(`  candidate id=${row.id} email=${row.email} created_at=${row.created_at}`)
    }
  }

  console.log(
    `[cleanup-unverified-customers] candidates=${report.candidates} deleted=${report.deleted}`,
  )
}

main()
  .catch((error) => {
    console.error('[cleanup-unverified-customers] failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end().catch(() => undefined)
  })
