import { Router } from 'express'

import {
  createCrmUserHandler,
  deleteCrmUserHandler,
  listCrmUsersHandler,
  patchCrmUserHandler,
  resetCrmUserPasswordHandler,
} from '../controllers/crm-users.controller'
import { requireCrmAuth } from '../middleware/require-crm-auth.middleware'
import { requireOwner } from '../middleware/require-owner.middleware'

export const crmUsersRouter = Router()

crmUsersRouter.use(requireCrmAuth())
crmUsersRouter.use(requireOwner)

crmUsersRouter.get('/', listCrmUsersHandler)
crmUsersRouter.post('/', createCrmUserHandler)
crmUsersRouter.patch('/:id', patchCrmUserHandler)
crmUsersRouter.post('/:id/password', resetCrmUserPasswordHandler)
crmUsersRouter.delete('/:id', deleteCrmUserHandler)
