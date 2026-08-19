import { Router } from 'express'

import { requireCrmAuth } from '../middleware/require-crm-auth.middleware'
import {
  createCrmPromoCodeHandler,
  deleteCrmPromoCodeHandler,
  listCrmPromoCodeUsagesHandler,
  listCrmPromoCodesHandler,
  patchCrmPromoCodeHandler,
} from '../controllers/crm-promo-codes.controller'

export const crmPromoCodesRouter = Router()

crmPromoCodesRouter.use(requireCrmAuth())

crmPromoCodesRouter.get('/', listCrmPromoCodesHandler)
crmPromoCodesRouter.post('/', createCrmPromoCodeHandler)
crmPromoCodesRouter.patch('/:id', patchCrmPromoCodeHandler)
crmPromoCodesRouter.delete('/:id', deleteCrmPromoCodeHandler)
crmPromoCodesRouter.get('/:id/usages', listCrmPromoCodeUsagesHandler)

