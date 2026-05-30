import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { sortCatalogNodes } from '../constants/catalog-category-order'
import { pressable, cardSurface } from '../lib/uiClasses'
import type { CatalogNode } from '../types/catalog'
import { SmartImage } from '../components/SmartImage'

type CatalogHomePageProps = {
  tree: CatalogNode[]
}

export const CatalogHomePage = ({ tree }: CatalogHomePageProps) => {
  const navigate = useNavigate()
  const sorted = useMemo(() => sortCatalogNodes(tree), [tree])

  return (
    <section className="space-y-5">
      <div className="rounded-3xl bg-muru-olive p-6 text-muru-ivory">
        <p className="text-xs uppercase tracking-widest opacity-90">MURU Home Design</p>
        <h1 className="mt-2 font-muru-display text-[2.05rem] font-medium leading-tight tracking-[0.01em]">
          Каталог MURU
        </h1>
        <p className="mt-1 text-sm">Выберите категорию и перейдите к подборке товаров.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {sorted.map((category, index) => (
          <button
            key={category.slug}
            type="button"
            className={`${pressable} ${cardSurface} muru-rise block p-3 transition-shadow hover:shadow-[0_4px_16px_rgba(60,55,40,0.09)]`}
            style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
            onClick={() => navigate(`/catalog/${encodeURIComponent(category.slug)}`)}
          >
            <div className="mb-3 aspect-[4/3] overflow-hidden rounded-xl bg-[#efe8d8]">
              {category.coverImageUrl ? (
                <SmartImage
                  src={category.coverImageUrl}
                  alt={category.name}
                  className="h-full w-full"
                  priority={index === 0}
                />
              ) : null}
            </div>
            <h2 className="line-clamp-2 min-h-10 text-sm font-medium leading-snug tracking-wide text-muru-olive">{category.name}</h2>
          </button>
        ))}
      </div>
      {sorted.length === 0 ? (
        <p className="text-center text-sm text-[#6f6666]">Категории появятся после синхронизации каталога.</p>
      ) : null}
    </section>
  )
}
