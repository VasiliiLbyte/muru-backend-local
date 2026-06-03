import { env } from '../../utils/env'
import { TtlCache } from '../../utils/cache'

export type AddressSuggestion = {
  value: string
  street?: string
  house?: string
  block?: string
  flat?: string
  postalCode?: string
  cityFiasId?: string
}

type DadataAddressData = {
  postal_code?: string | null
  city?: string | null
  city_with_type?: string | null
  city_fias_id?: string | null
  street?: string | null
  street_with_type?: string | null
  house?: string | null
  block?: string | null
  flat?: string | null
}

type DadataResponse = {
  suggestions?: Array<{
    value?: string
    data?: DadataAddressData
  }>
}

const SUGGEST_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address'
const REQUEST_TIMEOUT_MS = 5_000
const cache = new TtlCache<AddressSuggestion[]>(500, 10 * 60 * 1000)

const log = {
  warn: (payload: unknown, msg?: string) => console.warn('[dadata]', msg ?? '', payload),
}

/** DaData expects a short city name, not "Санкт-Петербург, Россия". */
export const normalizeDadataCityFilter = (cityName?: string): string | undefined => {
  const trimmed = cityName?.trim()
  if (!trimmed) return undefined
  const short = trimmed.split(',')[0]?.trim()
  return short || trimmed
}

const buildBody = (query: string, cityName?: string) => {
  const body: Record<string, unknown> = {
    query,
    count: 7,
    from_bound: { value: 'street' },
    to_bound: { value: 'house' },
  }
  const cityFilter = normalizeDadataCityFilter(cityName)
  if (cityFilter) {
    body.locations = [{ city: cityFilter }]
  }
  return body
}

const mapSuggestion = (s: NonNullable<DadataResponse['suggestions']>[number]): AddressSuggestion | null => {
  const value = (s.value ?? '').trim()
  if (!value) return null
  const data = s.data ?? {}
  return {
    value,
    street: data.street_with_type ?? data.street ?? undefined,
    house: data.house ?? undefined,
    block: data.block ?? undefined,
    flat: data.flat ?? undefined,
    postalCode: data.postal_code ?? undefined,
    cityFiasId: data.city_fias_id ?? undefined,
  }
}

export const suggestAddresses = async (
  query: string,
  cityName?: string,
): Promise<AddressSuggestion[]> => {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  if (!env.dadata.apiKey) return []

  const key = `${(cityName ?? '').toLowerCase()}|${trimmed.toLowerCase()}`
  const cached = cache.get(key)
  if (cached) return cached

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(SUGGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Token ${env.dadata.apiKey}`,
      },
      body: JSON.stringify(buildBody(trimmed, cityName)),
      signal: controller.signal,
    })

    if (!response.ok) {
      log.warn({ status: response.status }, 'suggest failed')
      return []
    }

    const data = (await response.json()) as DadataResponse
    const mapped = (data.suggestions ?? [])
      .map(mapSuggestion)
      .filter((row): row is AddressSuggestion => row !== null)
    cache.set(key, mapped)
    return mapped
  } catch (error) {
    log.warn({ error: error instanceof Error ? error.message : error }, 'request error')
    return []
  } finally {
    clearTimeout(timer)
  }
}

export const __clearDadataCacheForTests = (): void => {
  cache.clear()
}
