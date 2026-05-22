import { describe, expect, it } from 'vitest'

import { summarizeSyncErrors, SYNC_REASON_MISSING_SKU } from './google-sync-errors'

describe('summarizeSyncErrors', () => {
  it('groups errors by reason with counts and sample SKUs', () => {
    const errors = [
      { sku: 'UNKNOWN', reason: SYNC_REASON_MISSING_SKU },
      { sku: 'UNKNOWN', reason: SYNC_REASON_MISSING_SKU },
      { sku: 'MU0001', reason: 'Некорректные данные строки' },
    ]
    const { errorGroups, errors: capped } = summarizeSyncErrors(errors)
    expect(errorGroups).toHaveLength(2)
    expect(errorGroups[0].reason).toBe(SYNC_REASON_MISSING_SKU)
    expect(errorGroups[0].count).toBe(2)
    expect(errorGroups[0].sampleSkus).toEqual(['UNKNOWN'])
    expect(capped).toHaveLength(3)
  })

  it('caps detail errors at 20', () => {
    const errors = Array.from({ length: 30 }, (_, i) => ({
      sku: `MU${String(i).padStart(4, '0')}`,
      reason: SYNC_REASON_MISSING_SKU,
    }))
    const { errors: capped } = summarizeSyncErrors(errors)
    expect(capped).toHaveLength(20)
  })
})
