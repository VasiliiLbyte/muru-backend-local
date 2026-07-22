import { Router } from 'express'

import {
  addFavoriteHandler,
  createAddressHandler,
  deleteAddressHandler,
  forgotPasswordHandler,
  getMeHandler,
  getOrderHandler,
  listAddressesHandler,
  listFavoritesHandler,
  listOrdersHandler,
  loginHandler,
  logoutHandler,
  putMeHandler,
  putMePasswordHandler,
  refreshHandler,
  registerHandler,
  removeFavoriteHandler,
  requireCustomerAuth,
  resendVerifyHandler,
  resetPasswordHandler,
  updateAddressHandler,
  verifyEmailHandler,
} from '../controllers/account.controller'
import { rateLimitByIp } from '../middleware/simple-rate-limit'

export const accountRouter = Router()

accountRouter.post('/register', rateLimitByIp('account:register', 5), registerHandler)
accountRouter.post('/resend-verify', rateLimitByIp('account:resend-verify', 5), resendVerifyHandler)
accountRouter.get('/verify', verifyEmailHandler)
accountRouter.post('/login', rateLimitByIp('account:login', 10), loginHandler)
accountRouter.post('/logout', logoutHandler)
accountRouter.post('/refresh', rateLimitByIp('account:refresh', 30), refreshHandler)
accountRouter.post('/password/forgot', rateLimitByIp('account:forgot', 5), forgotPasswordHandler)
accountRouter.post('/password/reset', rateLimitByIp('account:reset', 5), resetPasswordHandler)

accountRouter.get('/me', requireCustomerAuth, getMeHandler)
accountRouter.put('/me', requireCustomerAuth, putMeHandler)
accountRouter.put('/me/password', requireCustomerAuth, putMePasswordHandler)

accountRouter.get('/addresses', requireCustomerAuth, listAddressesHandler)
accountRouter.post('/addresses', requireCustomerAuth, createAddressHandler)
accountRouter.put('/addresses/:id', requireCustomerAuth, updateAddressHandler)
accountRouter.delete('/addresses/:id', requireCustomerAuth, deleteAddressHandler)

accountRouter.get('/orders', requireCustomerAuth, listOrdersHandler)
accountRouter.get('/orders/:id', requireCustomerAuth, getOrderHandler)

accountRouter.get('/favorites', requireCustomerAuth, listFavoritesHandler)
accountRouter.post('/favorites', requireCustomerAuth, addFavoriteHandler)
accountRouter.delete('/favorites', requireCustomerAuth, removeFavoriteHandler)
