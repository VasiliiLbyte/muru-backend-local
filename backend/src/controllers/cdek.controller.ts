import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import { suggestCities } from '../services/cdek/cities.service'
import { calculateBothTariffs } from '../services/cdek/calc.service'
import { cdekFetch } from '../services/cdek/client'
import { buildPackagesFromCart } from '../services/cdek/packaging.service'
import { getPvzList } from '../services/cdek/pvz.service'
import { ok } from '../utils/api-response'

export const getCdekHealthHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const regions = await cdekFetch<unknown[]>('/location/regions', {
      method: 'GET',
      query: { country_codes: 'RU', size: 1 },
    })
    return ok(res, {
      status: 'ok',
      sample_count: Array.isArray(regions) ? regions.length : 0,
    })
  } catch (error) {
    next(error)
  }
}

export const getCitiesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q ?? '').trim()
    const rows = await suggestCities(q)
    return ok(res, rows)
  } catch (error) {
    next(error)
  }
}

export const getPvzHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cityCode = Number(req.query.cityCode)
    if (!Number.isInteger(cityCode) || cityCode <= 0) return ok(res, [])
    const rows = await getPvzList(cityCode)
    return ok(res, rows)
  } catch (error) {
    next(error)
  }
}

const calcSchema = z.object({
  toCityCode: z.number().int().positive(),
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
})

export const calculateHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = calcSchema.parse(req.body)
    const packages = await buildPackagesFromCart(parsed.items)
    const result = await calculateBothTariffs(parsed.toCityCode, packages)
    return ok(res, result)
  } catch (error) {
    next(error)
  }
}
