import type { CdekCity } from './api'

/** City name for DaData `locations` filter — without ", Россия" / region suffix. */
export const cityNameForAddressSuggest = (city: CdekCity): string => {
  const short = (city.city || '').trim()
  if (short && !short.includes(',')) return short
  const fromFull = (city.full_name || '').split(',')[0]?.trim() ?? ''
  return fromFull || short
}
