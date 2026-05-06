import { Router } from 'express'

import { telegramAuthHandler } from '../controllers/auth.controller'

export const authRouter = Router()

authRouter.post('/telegram', telegramAuthHandler)
