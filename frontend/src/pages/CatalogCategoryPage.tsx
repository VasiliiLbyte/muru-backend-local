import { Link } from 'react-router-dom'

import type { CatalogNode } from '../types/catalog'

type CatalogCategoryPageProps = {
  category: CatalogNode
}

export const CatalogCategoryPage = ({ category }: CatalogCategoryPageProps) => {
  return (
    <section>
      <h1 className="catalog-page-title">{category.name}</h1>
      <div className="category-grid">
        {category.children.map((subcategory) => (
          <Link
            key={subcategory.slug}
            to={`/catalog/${category.slug}/${subcategory.slug}`}
            className="category-card category-card--link"
          >
            <h2>{subcategory.name}</h2>
            <p>Перейти к товарам</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
