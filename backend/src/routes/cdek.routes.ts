import { Router } from 'express'

import {
  calculateHandler,
  calculateWebHandler,
  getAddressSuggestionsHandler,
  getCdekHealthHandler,
  getCitiesHandler,
  getPvzHandler,
  listTariffsHandler,
} from '../controllers/cdek.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { rateLimitByIp, rateLimitByUserOrIp } from '../middleware/simple-rate-limit'

const cdekRouter = Router()

cdekRouter.get('/health', getCdekHealthHandler)
cdekRouter.get('/cities', rateLimitByIp('cdek:cities', 60), getCitiesHandler)
cdekRouter.get('/tariff-list', rateLimitByIp('cdek:tariff-list', 30), listTariffsHandler)
cdekRouter.get(
  '/address-suggest',
  rateLimitByIp('cdek:address-suggest', 60),
  getAddressSuggestionsHandler,
)
cdekRouter.get('/pickup-points', rateLimitByIp('cdek:pickup-points', 30), getPvzHandler)
cdekRouter.post(
  '/web/calculate',
  rateLimitByIp('cdek:web:calculate', 20),
  calculateWebHandler,
)
cdekRouter.post(
  '/calculate',
  requireAuth,
  rateLimitByUserOrIp('cdek:calculate', 20),
  calculateHandler,
)

export { cdekRouter }
