import { Router } from 'express'

import { loginHandler, logoutHandler, meHandler } from '../controllers/admin-auth.controller'
import { rateLimitByIp } from '../middleware/simple-rate-limit'

export const adminAuthRouter = Router()

adminAuthRouter.post('/login', rateLimitByIp('admin-auth:login', 5), loginHandler)
adminAuthRouter.post('/logout', logoutHandler)
adminAuthRouter.get('/me', meHandler)
