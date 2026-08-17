import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}))

vi.mock('../utils/db', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}))

import { resolveProductSlugForCreate } from './product-slug.service'

describe('resolveProductSlugForCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns base slug when free (auto path)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const slug = await resolveProductSlugForCreate({
      name: 'Керамический салатник',
      sku: 'MU0001',
    })

    expect(slug).toBe('keramicheskiy-salatnik')
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('returns base-sku when base is taken', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // base taken
      .mockResolvedValueOnce({ rows: [] }) // withSku free

    const slug = await resolveProductSlugForCreate({
      name: 'Vaza',
      sku: 'MU0002',
    })

    expect(slug).toBe('vaza-mu0002')
    expect(mockQuery).toHaveBeenCalledTimes(2)
  })

  it('returns base-sku-2 when base and base-sku are taken', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 2 }] })
      .mockResolvedValueOnce({ rows: [] })

    const slug = await resolveProductSlugForCreate({
      name: 'Vaza',
      sku: 'MU0003',
    })

    expect(slug).toBe('vaza-mu0003-2')
    expect(mockQuery).toHaveBeenCalledTimes(3)
  })

  it('returns explicit slug when free', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const slug = await resolveProductSlugForCreate({
      name: 'Any',
      sku: 'MU0004',
      explicitSlug: 'My-Custom-Slug',
    })

    expect(slug).toBe('my-custom-slug')
  })

  it('throws 409 when explicit slug is taken', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 9 }] })

    await expect(
      resolveProductSlugForCreate({
        name: 'Any',
        sku: 'MU0005',
        explicitSlug: 'taken-slug',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Товар со slug taken-slug уже существует.',
    })
  })

  it('throws 409 for invalid slug format', async () => {
    await expect(
      resolveProductSlugForCreate({
        name: 'Any',
        sku: 'MU0006',
        explicitSlug: 'bad slug!',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Некорректный slug товара.',
    })
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('excludes self on explicit slug update check', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await resolveProductSlugForCreate({
      name: 'Any',
      sku: 'MU0007',
      explicitSlug: 'same-slug',
      excludeProductId: 42,
    })

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('id <> $2'),
      ['same-slug', 42],
    )
  })
})
