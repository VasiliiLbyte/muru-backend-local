import { Router } from 'express'

import { cdekFetch } from '../services/cdek/client'
import { ok } from '../utils/api-response'

const cdekRouter = Router()

cdekRouter.get('/health', async (_req, res, next) => {
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
})

export { cdekRouter }
