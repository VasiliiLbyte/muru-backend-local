import { HeartGlyph } from '../components/Glyphs'
import { SmartImage } from '../components/SmartImage'
import { formatPrice } from '../lib/format'
import { pressable, cardSurface } from '../lib/uiClasses'
import type { FavoriteItem } from '../types/favorite'

type FavoritesPageProps = {
  items: FavoriteItem[]
  userId?: number
  onGoCatalog: () => void
  onOpenProductDetail: (sku: string) => void
  onRemoveFavorite?: (item: FavoriteItem) => void | Promise<void>
  isLoading?: boolean
}

export const FavoritesPage = ({
  items,
  userId,
  onGoCatalog,
  onOpenProductDetail,
  onRemoveFavorite,
  isLoading = false,
}: FavoritesPageProps) => {
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
      <section
        className={`${cardSurface} flex min-h-[70vh] flex-col items-center justify-center p-6 text-center`}
      >
        <HeartGlyph className="h-16 w-16 text-muru-olive" />
        <p className="mt-4 font-muru-display text-[1.7rem] font-medium text-muru-olive">Здесь пока пусто</p>
        <button
          type="button"
          className={`${pressable} mt-5 rounded-xl bg-muru-olive-soft px-6 py-2.5 text-sm font-medium tracking-wide text-muru-ivory`}
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
            <button
              type="button"
              className={`${pressable} flex min-w-0 flex-1 items-center gap-3 text-left`}
              onClick={() => onOpenProductDetail(item.sku)}
            >
              <SmartImage src={item.imageUrl} alt={item.name} className="h-16 w-16 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold leading-snug">{item.name}</h2>
                <p className="text-sm">{formatPrice(item.price)}</p>
              </div>
            </button>
            {userId && onRemoveFavorite ? (
              <button
                type="button"
                className={`${pressable} shrink-0 rounded-lg p-2 text-muru-text hover:bg-[#fde2e2]`}
                aria-label={`Удалить «${item.name}» из избранного`}
                onClick={(e) => {
                  e.stopPropagation()
                  void onRemoveFavorite(item)
                }}
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

