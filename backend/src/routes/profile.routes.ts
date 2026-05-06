import { Router } from 'express'

import { getMyProfileHandler, saveMyProfileHandler } from '../controllers/profile.controller'

const profileRouter = Router()

profileRouter.get('/me', getMyProfileHandler)
profileRouter.post('/save', saveMyProfileHandler)

export { profileRouter }

