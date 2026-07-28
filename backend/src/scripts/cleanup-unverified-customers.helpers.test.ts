import { describe, expect, it, vi } from 'vitest'

import {
  DELETE_UNVERIFIED_BY_IDS_SQL,
  SELECT_UNVERIFIED_CANDIDATES_SQL,
  parseCleanupArgs,
  runUnverifiedCustomerCleanup,
} from './cleanup-unverified-customers.helpers'

describe('cleanup-unverified-customers helpers', () => {
  it('parseCleanupArgs defaults to dry-run; --apply enables write; both stay dry', () => {
    expect(parseCleanupArgs([])).toMatchObject({ dryRun: true, olderThanDays: 14 })
    expect(parseCleanupArgs(['--apply'])).toMatchObject({ dryRun: false })
    expect(parseCleanupArgs(['--dry-run', '--apply'])).toMatchObject({ dryRun: true })
  })

  it('selection SQL requires unverified and age interval param', () => {
    expect(SELECT_UNVERIFIED_CANDIDATES_SQL).toContain('email_verified_at IS NULL')
    expect(SELECT_UNVERIFIED_CANDIDATES_SQL).toContain("INTERVAL '1 day'")
    expect(DELETE_UNVERIFIED_BY_IDS_SQL).toContain('DELETE FROM customers')
    expect(DELETE_UNVERIFIED_BY_IDS_SQL).toContain('email_verified_at IS NULL')
  })

  it('dry-run reports candidates and never calls DELETE', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT id, email, created_at')) {
        return {
          rows: [
            { id: 1, email: 'old@example.com', created_at: '2020-01-01' },
            { id: 2, email: 'older@example.com', created_at: '2020-02-01' },
          ],
        }
      }
      throw new Error(`unexpected SQL: ${sql}`)
    })

    const report = await runUnverifiedCustomerCleanup(query, {
      dryRun: true,
      olderThanDays: 14,
    })

    expect(report.candidates).toBe(2)
    expect(report.deleted).toBe(0)
    expect(report.dryRun).toBe(true)
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0]![0]).toContain('email_verified_at IS NULL')
    expect(query.mock.calls.some((c) => String(c[0]).includes('DELETE'))).toBe(false)
  })

  it('apply deletes candidate ids', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT id, email, created_at')) {
        return {
          rows: [{ id: 9, email: 'gone@example.com', created_at: '2020-01-01' }],
        }
      }
      if (sql.includes('DELETE FROM customers')) {
        return { rows: [{ id: 9 }] }
      }
      throw new Error(`unexpected SQL: ${sql}`)
    })

    const report = await runUnverifiedCustomerCleanup(query, {
      dryRun: false,
      olderThanDays: 14,
    })

    expect(report.candidates).toBe(1)
    expect(report.deleted).toBe(1)
    expect(query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM customers'), [[9]])
  })
})
