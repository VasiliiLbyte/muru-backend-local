import { TtlCache } from '../../utils/cache'
import { cdekFetch } from './client'

export type PvzPoint = {
  code: string
  name: string
  address: string
  workTime: string
  phones: string[]
  location: { latitude: number; longitude: number }
  allowedCod: boolean
  isHandout: boolean
  isReception: boolean
  ownerCode: string
  dimensions?: Array<{ width: number; height: number; depth: number }>
  weightMax?: number
  note?: string
}

const cache = new TtlCache<PvzPoint[]>(200, 60 * 60 * 1000)

type CdekDeliveryPoint = {
  code: string
  name: string
  work_time?: string
  phones?: Array<{ number?: string }>
  location?: {
    address_full?: string
    address?: string
    latitude?: number
    longitude?: number
  }
  allowed_cod?: boolean
  is_handout?: boolean
  is_reception?: boolean
  owner_code?: string
  weight_max?: number
  dimensions?: Array<{ width: number; height: number; depth: number }>
  note?: string
}

export const getPvzList = async (cityCode: number): Promise<PvzPoint[]> => {
  const key = `pvz:${cityCode}`
  const cached = cache.get(key)
  if (cached) return cached
  const rows = await cdekFetch<CdekDeliveryPoint[]>('/deliverypoints', {
    method: 'GET',
    query: {
      city_code: cityCode,
      type: 'PVZ',
      country_code: 'RU',
      is_handout: true,
      lang: 'rus',
    },
  })
  const mapped: PvzPoint[] = (rows ?? []).map((r) => ({
    code: r.code,
    name: r.name,
    address: r.location?.address_full ?? r.location?.address ?? '',
    workTime: r.work_time ?? '',
    phones: (r.phones ?? []).map((p) => p.number).filter((n): n is string => Boolean(n)),
    location: {
      latitude: r.location?.latitude ?? 0,
      longitude: r.location?.longitude ?? 0,
    },
    allowedCod: !!r.allowed_cod,
    isHandout: !!r.is_handout,
    isReception: !!r.is_reception,
    ownerCode: r.owner_code ?? 'cdek',
    weightMax: r.weight_max,
    dimensions: r.dimensions,
    note: r.note,
  }))
  cache.set(key, mapped)
  return mapped
}
