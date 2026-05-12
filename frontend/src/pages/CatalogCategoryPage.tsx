import { Link } from 'react-router-dom'

import { pressable } from '../lib/uiClasses'
import type { CatalogNode } from '../types/catalog'

type CatalogCategoryPageProps = {
  category: CatalogNode
}

export const CatalogCategoryPage = ({ category }: CatalogCategoryPageProps) => {
  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold text-muru-olive">{category.name}</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {category.children.map((subcategory) => (
          <Link
            key={subcategory.slug}
            to={`/catalog/${category.slug}/${subcategory.slug}`}
            className={`${pressable} block rounded-2xl border border-muru-accent bg-[#fff9ed] p-3 hover:bg-[#f5efdf]`}
          >
            <div className="mb-3 aspect-[4/3] rounded-xl bg-[#efe8d8]"></div>
            <h2 className="text-sm font-semibold text-muru-olive">{subcategory.name}</h2>
            <p className="mt-1 text-xs">Перейти к товарам</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
