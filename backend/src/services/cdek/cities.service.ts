import { TtlCache } from '../../utils/cache'
import { cdekFetch } from './client'

export type SuggestRow = {
  code: number
  full_name: string
  city: string
  region: string
  country_code: string
}

const cache = new TtlCache<SuggestRow[]>(500, 10 * 60 * 1000)

export const suggestCities = async (q: string): Promise<SuggestRow[]> => {
  const query = q.trim()
  if (query.length < 2) return []
  const key = `s:${query.toLowerCase()}`
  const cached = cache.get(key)
  if (cached) return cached

  const rows = await cdekFetch<
    Array<{
      code: number
      full_name?: string
      city?: string
      region?: string
      country_code: string
    }>
  >('/location/suggest/cities', {
    method: 'GET',
    query: { name: query, country_code: 'RU' },
  })
  const mapped: SuggestRow[] = (rows ?? []).slice(0, 15).map((r) => {
    const fullName = (r.full_name ?? r.city ?? '').trim()
    const city =
      (r.city ?? fullName.split(',')[0]?.trim() ?? '').trim() || fullName
    return {
      code: r.code,
      full_name: fullName,
      city,
      region: (r.region ?? '').trim(),
      country_code: r.country_code,
    }
  })
  cache.set(key, mapped)
  return mapped
}
