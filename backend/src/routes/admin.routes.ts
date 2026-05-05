import { Router } from 'express'

import { syncCatalogHandler } from '../controllers/admin.controller'

const adminRouter = Router()

adminRouter.post('/sync', syncCatalogHandler)

export { adminRouter }
