import type { FavoriteItem } from '../types/favorite'
import { SmartImage } from '../components/SmartImage'

type FavoritesPageProps = {
  items: FavoriteItem[]
  onGoCatalog: () => void
  isLoading?: boolean
}

export const FavoritesPage = ({ items, onGoCatalog, isLoading = false }: FavoritesPageProps) => {
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
          className="mt-5 rounded-xl bg-[#8f2b2b] px-6 py-3 text-sm font-semibold text-[#fff5ef]"
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
          <article key={item.sku} className="flex items-center gap-3 rounded-xl border border-muru-accent bg-[#fff9ed] p-3">
            <SmartImage src={item.imageUrl} alt={item.name} className="h-16 w-16 rounded-lg object-cover" />
            <div className="flex-1">
              <h2 className="text-sm font-semibold">{item.name}</h2>
              <p className="text-sm">{item.price.toFixed(2)} ₽</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

