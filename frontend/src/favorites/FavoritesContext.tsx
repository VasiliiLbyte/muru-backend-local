import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import { addFavorite, fetchMyFavorites, removeFavorite } from '../lib/api'
import type { FavoriteItem } from '../types/favorite'

type FavoritesContextValue = {
  favorites: FavoriteItem[]
  favoriteSkus: Set<string>
  isLoading: boolean
  loadFavorites: (telegramUserId?: number) => Promise<void>
  toggleFavorite: (telegramUserId: number | undefined, item: FavoriteItem) => Promise<void>
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

export const FavoritesProvider = ({ children }: { children: ReactNode }) => {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const favoriteSkus = useMemo(() => new Set(favorites.map((item) => item.sku)), [favorites])

  const loadFavorites = useCallback(async (telegramUserId?: number) => {
    if (!telegramUserId) return
    setIsLoading(true)
    try {
      const items = await fetchMyFavorites(telegramUserId)
      setFavorites(items)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const toggleFavorite = useCallback(
    async (telegramUserId: number | undefined, item: FavoriteItem) => {
      if (!telegramUserId) throw new Error('Требуется авторизация в Telegram')

      const isFavorite = favoriteSkus.has(item.sku)
      if (isFavorite) {
        await removeFavorite(telegramUserId, item.sku)
        setFavorites((prev) => prev.filter((current) => current.sku !== item.sku))
      } else {
        await addFavorite(telegramUserId, item.sku)
        setFavorites((prev) => [item, ...prev.filter((current) => current.sku !== item.sku)])
      }
    },
    [favoriteSkus],
  )

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favorites,
      favoriteSkus,
      isLoading,
      loadFavorites,
      toggleFavorite,
    }),
    [favorites, favoriteSkus, isLoading, loadFavorites, toggleFavorite],
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useFavorites = () => {
  const context = useContext(FavoritesContext)
  if (!context) throw new Error('useFavorites must be used inside FavoritesProvider')
  return context
}

