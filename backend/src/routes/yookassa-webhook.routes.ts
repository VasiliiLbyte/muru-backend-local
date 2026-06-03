import { Router } from 'express'

import {
  yookassaIpGuard,
  yookassaWebhookHandler,
} from '../controllers/yookassa-webhook.controller'

const yookassaWebhookRouter = Router()

yookassaWebhookRouter.post('/', yookassaIpGuard, yookassaWebhookHandler)

export { yookassaWebhookRouter }
