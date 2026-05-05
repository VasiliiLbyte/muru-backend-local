import { Link } from 'react-router-dom'

import type { CatalogNode } from '../types/catalog'

type CatalogHomePageProps = {
  tree: CatalogNode[]
}

export const CatalogHomePage = ({ tree }: CatalogHomePageProps) => {
  return (
    <section>
      <div className="hero-banner">
        <p className="hero-banner__badge">MURU Home Design</p>
        <h1>Каталог MURU</h1>
        <p>Выберите категорию и перейдите к подборке товаров.</p>
      </div>
      <div className="category-grid category-grid--big">
        {tree.map((category) => (
          <Link
            key={category.slug}
            to={`/catalog/${category.slug}`}
            className="category-card category-card--link"
          >
            <h2>{category.name}</h2>
            <p>{category.children.length} подкатегорий</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
