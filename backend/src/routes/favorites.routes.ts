import { Router } from 'express'

import { addFavoriteHandler, getMyFavoritesHandler, removeFavoriteHandler } from '../controllers/favorites.controller'

const favoritesRouter = Router()

favoritesRouter.get('/my', getMyFavoritesHandler)
favoritesRouter.post('/add', addFavoriteHandler)
favoritesRouter.post('/remove', removeFavoriteHandler)

export { favoritesRouter }

