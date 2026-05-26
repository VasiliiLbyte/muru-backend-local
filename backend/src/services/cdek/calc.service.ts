import { env } from '../../utils/env'
import { cdekFetch } from './client'

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

export const calculateTariff = async (input: CalcInput): Promise<CalcResult> => {
  const body = {
    type: 1,
    tariff_code: input.tariffCode,
    from_location: { code: env.cdek.senderCityCode },
    to_location: { code: input.toCityCode },
    packages: input.packages.map((p) => ({
      weight: Math.max(100, Math.round(p.weight)),
      length: p.length ?? 20,
      width: p.width ?? 20,
      height: p.height ?? 20,
    })),
  }
  const r = await cdekFetch<CdekCalcResponse>('/calculator/tariff', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return {
    tariffCode: r.tariff_code ?? input.tariffCode,
    deliverySum: Number(r.delivery_sum ?? 0),
    periodMin: Number(r.period_min ?? 0),
    periodMax: Number(r.period_max ?? 0),
    calendarMin: r.calendar_min,
    calendarMax: r.calendar_max,
    totalSum: r.total_sum,
    errors: r.errors,
  }
}

export const calculateBothTariffs = async (toCityCode: number, packages: CalcPackage[]) => {
  const [door, pvz] = await Promise.allSettled([
    calculateTariff({ tariffCode: env.cdek.tariffDoor, toCityCode, packages }),
    calculateTariff({ tariffCode: env.cdek.tariffPvz, toCityCode, packages }),
  ])
  const reasonMessage = (reason: unknown) => {
    if (reason instanceof Error) return reason.message
    return String(reason)
  }
  return {
    door: door.status === 'fulfilled' ? door.value : null,
    pvz: pvz.status === 'fulfilled' ? pvz.value : null,
    errors: [
      ...(door.status === 'rejected' ? [reasonMessage(door.reason)] : []),
      ...(pvz.status === 'rejected' ? [reasonMessage(pvz.reason)] : []),
    ],
  }
}
