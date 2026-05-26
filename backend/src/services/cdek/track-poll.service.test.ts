import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../utils/db', () => ({
  pool: { query: vi.fn() },
}))

vi.mock('./client', () => ({
  cdekFetch: vi.fn(),
  CdekApiError: class CdekApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      public payload: unknown,
      message: string,
    ) {
      super(message)
      this.name = 'CdekApiError'
    }
  },
}))

vi.mock('../telegram-http.service', () => ({
  callTelegramApi: vi.fn().mockResolvedValue(undefined),
}))

import { pool } from '../../utils/db'
import { callTelegramApi } from '../telegram-http.service'
import { cdekFetch } from './client'
import { fetchAndStoreTrackNumber } from './track-poll.service'

const poolQueryMock = vi.mocked(pool.query)
const cdekFetchMock = vi.mocked(cdekFetch)
const telegramMock = vi.mocked(callTelegramApi)

describe('fetchAndStoreTrackNumber', () => {
  beforeEach(() => {
    poolQueryMock.mockReset()
    cdekFetchMock.mockReset()
    telegramMock.mockReset()
  })

  it('stores track number and notifies client', async () => {
    cdekFetchMock.mockResolvedValue({
      entity: {
        cdek_number: '10123456789',
        statuses: [{ code: 'ACCEPTED' }],
      },
    })
    poolQueryMock
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] } as never)
      .mockResolvedValueOnce({ rows: [{ telegram_user_id: '999' }] } as never)

    const got = await fetchAndStoreTrackNumber(1, 'uuid-1')
    expect(got).toBe(true)
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('cdek_track_number'),
      expect.arrayContaining([1, '10123456789']),
    )
    expect(telegramMock).toHaveBeenCalled()
  })

  it('returns false when track not ready', async () => {
    cdekFetchMock.mockResolvedValue({ entity: { statuses: [] } })
    const got = await fetchAndStoreTrackNumber(1, 'uuid-1')
    expect(got).toBe(false)
    expect(telegramMock).not.toHaveBeenCalled()
  })
})
