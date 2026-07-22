import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPoolQuery = vi.fn()

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockPoolQuery(...args),
  },
}))

import { addFavorite } from './favorites.service'

describe('favorites.service mini-app path (I1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPoolQuery.mockResolvedValue({ rows: [] })
  })

  it('uses partial unique ON CONFLICT for telegram favorites', async () => {
    await addFavorite({ telegramUserId: 123, sku: 'MU0001' })
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining(
        'ON CONFLICT (telegram_user_id, product_sku) WHERE (telegram_user_id IS NOT NULL) DO NOTHING',
      ),
      [123, 'MU0001'],
    )
  })
})
