/**
 * Backfill orders.customer_email / customer_phone from succeeded payments.checkout_snapshot.
 * Does NOT set customer_id (account linking is verifyEmailToken / W4.3).
 *
 * Usage:
 *   npx tsx src/scripts/backfill-order-customer-contacts.ts           # dry-run (default)
 *   npx tsx src/scripts/backfill-order-customer-contacts.ts --dry-run
 *   npx tsx src/scripts/backfill-order-customer-contacts.ts --apply
 */

import { pool } from '../utils/db'
import { normalizeEmail } from '../utils/normalize-email'
import { normalizeRussianPhone } from '../services/cdek/phone'

type SnapshotShape = {
  email?: string | null
  recipientPhone?: string | null
}

type Row = {
  payment_id: number
  order_id: number | null
  snapshot: SnapshotShape | string | null
  order_customer_email: string | null
  order_customer_phone: string | null
}

const parseArgs = (argv: string[]) => {
  const apply = argv.includes('--apply')
  const forceDry = argv.includes('--dry-run')
  // Default dry-run; --apply writes; if both flags present, stay dry-run (safe).
  return { dryRun: forceDry || !apply }
}

const asSnapshot = (raw: Row['snapshot']): SnapshotShape => {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as SnapshotShape
    } catch {
      return {}
    }
  }
  return raw
}

async function main(): Promise<void> {
  const { dryRun } = parseArgs(process.argv.slice(2))
  const mode = dryRun ? 'DRY-RUN' : 'APPLY'
  console.log(`[backfill-order-contacts] mode=${mode}`)

  const result = await pool.query<Row>(
    `SELECT
       p.id AS payment_id,
       p.order_id,
       p.checkout_snapshot AS snapshot,
       o.customer_email AS order_customer_email,
       o.customer_phone AS order_customer_phone
     FROM payments p
     LEFT JOIN orders o ON o.id = p.order_id
     WHERE p.status = 'succeeded'
       AND (
         NULLIF(trim(p.checkout_snapshot->>'email'), '') IS NOT NULL
         OR NULLIF(trim(p.checkout_snapshot->>'recipientPhone'), '') IS NOT NULL
       )
     ORDER BY p.id`,
  )

  let matched = 0
  let updated = 0
  let skipped = 0
  let failed = 0
  const unmatched: string[] = []

  for (const row of result.rows) {
    matched += 1
    if (row.order_id == null) {
      failed += 1
      unmatched.push(`payment=${row.payment_id}: no order_id`)
      continue
    }

    const snap = asSnapshot(row.snapshot)
    const emailRaw = typeof snap.email === 'string' ? snap.email.trim() : ''
    const phoneRaw = typeof snap.recipientPhone === 'string' ? snap.recipientPhone : ''

    const nextEmail = emailRaw ? normalizeEmail(emailRaw) : null
    const nextPhone = phoneRaw ? normalizeRussianPhone(phoneRaw) : null

    if (!nextEmail && !nextPhone) {
      failed += 1
      unmatched.push(`payment=${row.payment_id} order=${row.order_id}: empty/invalid snapshot contacts`)
      continue
    }

    const needEmail = nextEmail && !row.order_customer_email
    const needPhone = nextPhone && !row.order_customer_phone

    if (!needEmail && !needPhone) {
      skipped += 1
      continue
    }

    if (dryRun) {
      updated += 1
      console.log(
        `[dry-run] would update order=${row.order_id}` +
          (needEmail ? ` email=${nextEmail}` : '') +
          (needPhone ? ` phone=${nextPhone}` : ''),
      )
      continue
    }

    try {
      await pool.query(
        `UPDATE orders SET
           customer_email = COALESCE(customer_email, $2),
           customer_phone = COALESCE(customer_phone, $3),
           updated_at = NOW()
         WHERE id = $1
           AND (customer_email IS NULL OR customer_phone IS NULL)`,
        [row.order_id, nextEmail, nextPhone],
      )
      updated += 1
    } catch (error) {
      failed += 1
      unmatched.push(
        `payment=${row.payment_id} order=${row.order_id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  console.log('[backfill-order-contacts] report')
  console.log(`  matched:  ${matched}`)
  console.log(`  updated:  ${updated}${dryRun ? ' (would-update)' : ''}`)
  console.log(`  skipped:  ${skipped}`)
  console.log(`  failed:   ${failed}`)
  if (unmatched.length > 0) {
    console.log('  unmatched / errors:')
    for (const line of unmatched.slice(0, 50)) {
      console.log(`    - ${line}`)
    }
    if (unmatched.length > 50) {
      console.log(`    … and ${unmatched.length - 50} more`)
    }
  }
  if (matched === 0) {
    console.log('  note: no succeeded payments with snapshot email/phone on this DB')
  }

  await pool.end()
}

main().catch(async (error) => {
  console.error('[backfill-order-contacts] fatal:', error)
  try {
    await pool.end()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
