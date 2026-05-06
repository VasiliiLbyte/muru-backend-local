import { Router } from 'express'

import { addFavoriteHandler, getMyFavoritesHandler, removeFavoriteHandler } from '../controllers/favorites.controller'
import { requireAuth } from '../middleware/auth.middleware'

const favoritesRouter = Router()

favoritesRouter.use(requireAuth)
favoritesRouter.get('/my', getMyFavoritesHandler)
favoritesRouter.post('/add', addFavoriteHandler)
favoritesRouter.post('/remove', removeFavoriteHandler)

export { favoritesRouter }

