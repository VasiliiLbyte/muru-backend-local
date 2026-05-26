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
    Array<{ code: number; full_name: string; city: string; region?: string; country_code: string }>
  >('/location/suggest/cities', {
    method: 'GET',
    query: { name: query, country_code: 'RU' },
  })
  const mapped: SuggestRow[] = (rows ?? []).slice(0, 15).map((r) => ({
    code: r.code,
    full_name: r.full_name,
    city: r.city,
    region: r.region ?? '',
    country_code: r.country_code,
  }))
  cache.set(key, mapped)
  return mapped
}
