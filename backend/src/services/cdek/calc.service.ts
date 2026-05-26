import { env } from '../../utils/env'
import { cdekFetch, CdekApiError } from './client'

export type CalcPackage = { weight: number; length?: number; width?: number; height?: number }

export type CalcInput = {
  tariffCode: number
  toCityCode: number
  packages: CalcPackage[]
}

export type CalcResult = {
  tariffCode: number
  deliverySum: number
  periodMin: number
  periodMax: number
  calendarMin?: number
  calendarMax?: number
  totalSum?: number
  errors?: Array<{ code: string; message: string }>
}

export type TariffListItem = {
  tariffCode: number
  tariffName: string
  tariffDescription?: string
  deliverySum: number
  periodMin: number
  periodMax: number
}

type CdekCalcResponse = {
  tariff_code?: number
  delivery_sum?: number
  period_min?: number
  period_max?: number
  calendar_min?: number
  calendar_max?: number
  total_sum?: number
  errors?: Array<{ code: string; message: string }>
}

const buildCalcPackages = (packages: CalcPackage[]) =>
  packages.map((p) => ({
    weight: Math.max(100, Math.round(p.weight)),
    length: p.length ?? 20,
    width: p.width ?? 20,
    height: p.height ?? 20,
  }))

const formatResultErrors = (errors?: Array<{ code?: string; message?: string }>) =>
  (errors ?? [])
    .map((x) => `${x.code ?? '?'}: ${x.message ?? '?'}`)
    .join('; ')

export const formatCdekErrors = (e: unknown): string => {
  if (e instanceof CdekApiError) {
    const payload = e.payload as { errors?: Array<{ code?: string; message?: string }> } | null
    const errs = payload?.errors ?? []
    if (errs.length > 0) {
      return errs.map((x) => `${x.code ?? '?'}: ${x.message ?? '?'}`).join('; ')
    }
    return `${e.status}: ${e.message}`
  }
  if (e instanceof Error) return e.message
  return String(e)
}

export const calculateTariff = async (input: CalcInput): Promise<CalcResult> => {
  const body = {
    type: 1,
    tariff_code: input.tariffCode,
    from_location: { code: env.cdek.senderCityCode },
    to_location: { code: input.toCityCode },
    packages: buildCalcPackages(input.packages),
  }
  const r = await cdekFetch<CdekCalcResponse>('/calculator/tariff', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const result: CalcResult = {
    tariffCode: r.tariff_code ?? input.tariffCode,
    deliverySum: Number(r.delivery_sum ?? 0),
    periodMin: Number(r.period_min ?? 0),
    periodMax: Number(r.period_max ?? 0),
    calendarMin: r.calendar_min,
    calendarMax: r.calendar_max,
    totalSum: r.total_sum,
    errors: r.errors,
  }
  if (result.errors?.length && result.deliverySum <= 0) {
    const msg = formatResultErrors(result.errors)
    throw new CdekApiError(200, '/calculator/tariff', r, msg)
  }
  return result
}

export const calculateBothTariffs = async (toCityCode: number, packages: CalcPackage[]) => {
  const [door, pvz] = await Promise.allSettled([
    calculateTariff({ tariffCode: env.cdek.tariffDoor, toCityCode, packages }),
    calculateTariff({ tariffCode: env.cdek.tariffPvz, toCityCode, packages }),
  ])
  return {
    door: door.status === 'fulfilled' ? door.value : null,
    pvz: pvz.status === 'fulfilled' ? pvz.value : null,
    errors: [
      ...(door.status === 'rejected' ? [formatCdekErrors(door.reason)] : []),
      ...(pvz.status === 'rejected' ? [formatCdekErrors(pvz.reason)] : []),
    ],
  }
}

export const fetchAvailableTariffs = async (
  toCityCode: number,
  packages: CalcPackage[],
): Promise<TariffListItem[]> => {
  const body = {
    type: 1,
    from_location: { code: env.cdek.senderCityCode },
    to_location: { code: toCityCode },
    packages: buildCalcPackages(packages),
  }
  const r = await cdekFetch<{
    tariff_codes?: Array<{
      tariff_code: number
      tariff_name: string
      tariff_description?: string
      delivery_sum: number
      period_min: number
      period_max: number
    }>
  }>('/calculator/tarifflist', { method: 'POST', body: JSON.stringify(body) })
  return (r.tariff_codes ?? []).map((t) => ({
    tariffCode: t.tariff_code,
    tariffName: t.tariff_name,
    tariffDescription: t.tariff_description,
    deliverySum: Number(t.delivery_sum ?? 0),
    periodMin: Number(t.period_min ?? 0),
    periodMax: Number(t.period_max ?? 0),
  }))
}
