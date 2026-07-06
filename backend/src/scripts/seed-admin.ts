import bcrypt from 'bcryptjs'

import { pool } from '../utils/db'

// Matches admin-auth.service.ts normalizeEmail (not exported from A1).
const normalizeEmail = (email: string): string => email.trim().toLowerCase()

const USAGE =
  'Usage: ADMIN_SEED_EMAIL=owner@example.com ADMIN_SEED_PASSWORD=... npm run seed:admin'

async function main(): Promise<void> {
  const rawEmail = process.env.ADMIN_SEED_EMAIL
  const password = process.env.ADMIN_SEED_PASSWORD

  if (!rawEmail?.trim() || !password) {
    console.error('ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD are required (pass via shell env, not .env).')
    console.error(USAGE)
    process.exit(1)
    return
  }

  const email = normalizeEmail(rawEmail)
  const passwordHash = await bcrypt.hash(password, 12)

  await pool.query(
    `INSERT INTO admin_users (email, password_hash, role, is_active)
     VALUES ($1, $2, 'owner', true)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, role = 'owner', is_active = true`,
    [email, passwordHash],
  )

  console.log(`email: ${email}`)
  console.log('role: owner')

  await pool.end()
  process.exit(0)
}

main().catch(async (err) => {
  console.error(err)
  await pool.end().catch(() => {})
  process.exit(1)
})
