import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { sortCatalogNodes } from '../constants/catalog-category-order'
import type { CatalogNode } from '../types/catalog'

type CatalogHomePageProps = {
  tree: CatalogNode[]
}

export const CatalogHomePage = ({ tree }: CatalogHomePageProps) => {
  const navigate = useNavigate()
  const sorted = useMemo(() => sortCatalogNodes(tree), [tree])

  return (
    <section className="space-y-4">
      <div className="rounded-3xl bg-muru-olive p-5 text-muru-ivory">
        <p className="text-xs uppercase tracking-widest opacity-90">MURU Home Design</p>
        <h1 className="mt-2 text-2xl font-semibold">Каталог MURU</h1>
        <p className="mt-1 text-sm">Выберите категорию и перейдите к подборке товаров.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {sorted.map((category) => (
          <button
            key={category.slug}
            type="button"
            className="block rounded-2xl border border-muru-accent bg-[#fff9ed] p-3 hover:bg-[#f5efdf]"
            onClick={() => navigate(`/catalog/${encodeURIComponent(category.slug)}`)}
          >
            <div className="mb-3 aspect-[4/3] rounded-xl bg-[#efe8d8]"></div>
            <h2 className="text-sm font-semibold text-muru-olive">{category.name}</h2>
            <p className="mt-1 text-xs">{category.children.length} подкатегорий</p>
          </button>
        ))}
      </div>
      {sorted.length === 0 ? (
        <p className="text-center text-sm text-[#6f6666]">Категории появятся после синхронизации каталога.</p>
      ) : null}
    </section>
  )
}
