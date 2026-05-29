import { Link } from 'react-router-dom'

import { SmartImage } from '../components/SmartImage'
import { pressable, cardSurface } from '../lib/uiClasses'
import type { CatalogNode } from '../types/catalog'

type CatalogCategoryPageProps = {
  category: CatalogNode
}

export const CatalogCategoryPage = ({ category }: CatalogCategoryPageProps) => {
  return (
    <section className="space-y-3">
      <h1 className="font-muru-display text-[1.7rem] font-medium tracking-[0.01em] text-muru-olive">
        {category.name}
      </h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {category.children.map((subcategory, i) => (
          <Link
            key={subcategory.slug}
            to={`/catalog/${category.slug}/${subcategory.slug}`}
            className={`${pressable} ${cardSurface} muru-rise block p-3 transition-shadow hover:shadow-[0_4px_16px_rgba(60,55,40,0.09)]`}
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
          >
            <div className="mb-3 aspect-[4/3] overflow-hidden rounded-xl bg-[#efe8d8]">
              {subcategory.coverImageUrl ? (
                <SmartImage
                  src={subcategory.coverImageUrl}
                  alt={subcategory.name}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <h2 className="text-sm font-medium tracking-wide text-muru-olive">{subcategory.name}</h2>
            <p className="mt-1 text-xs">Перейти к товарам</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
