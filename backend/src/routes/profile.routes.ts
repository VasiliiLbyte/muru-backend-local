import { Router } from 'express'

import { getMyProfileHandler, saveMyProfileHandler } from '../controllers/profile.controller'
import { requireAuth } from '../middleware/auth.middleware'

const profileRouter = Router()

profileRouter.use(requireAuth)
profileRouter.get('/me', getMyProfileHandler)
profileRouter.post('/save', saveMyProfileHandler)

export { profileRouter }

