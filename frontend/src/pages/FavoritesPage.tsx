import { SmartImage } from '../components/SmartImage'
import { pressable } from '../lib/uiClasses'
import type { FavoriteItem } from '../types/favorite'

type FavoritesPageProps = {
  items: FavoriteItem[]
  userId?: number
  onGoCatalog: () => void
  onRemoveFavorite?: (item: FavoriteItem) => void | Promise<void>
  isLoading?: boolean
}

export const FavoritesPage = ({ items, userId, onGoCatalog, onRemoveFavorite, isLoading = false }: FavoritesPageProps) => {
  if (isLoading) {
    return (
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold text-[#5e5252]">Избранное</h1>
        <div className="grid gap-2">
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="h-20 animate-pulse rounded-xl bg-[#efe8d8]" />
          ))}
        </div>
      </section>
    )
  }

  if (items.length === 0) {
    return (
      <section className="flex min-h-[70vh] flex-col items-center justify-center rounded-2xl border border-muru-accent bg-[#fff9ed] p-6 text-center">
        <div className="text-8xl text-red-600">❤️</div>
        <p className="mt-4 text-3xl font-semibold text-[#5e5252]">Здесь пока пусто</p>
        <button
          type="button"
          className={`${pressable} mt-5 rounded-xl bg-[#8f2b2b] px-6 py-3 text-sm font-semibold text-[#fff5ef]`}
          onClick={onGoCatalog}
        >
          Перейти в каталог
        </button>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <h1 className="text-3xl font-semibold text-[#5e5252]">Избранное</h1>
      <div className="grid gap-2">
        {items.map((item) => (
          <article
            key={item.sku}
            className="flex items-center gap-3 rounded-xl border border-muru-accent bg-[#fff9ed] p-3 pr-2"
          >
            <SmartImage src={item.imageUrl} alt={item.name} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold leading-snug">{item.name}</h2>
              <p className="text-sm">{item.price.toFixed(2)} ₽</p>
            </div>
            {userId && onRemoveFavorite ? (
              <button
                type="button"
                className={`${pressable} shrink-0 rounded-lg p-2 text-muru-text hover:bg-[#fde2e2]`}
                aria-label={`Удалить «${item.name}» из избранного`}
                onClick={() => void onRemoveFavorite(item)}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <path d="M3 6h18" strokeLinecap="round" />
                  <path d="M8 6V4h8v2" strokeLinecap="round" />
                  <path d="M19 6l-1 14H6L5 6" strokeLinejoin="round" />
                  <path d="M10 11v6M14 11v6" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

