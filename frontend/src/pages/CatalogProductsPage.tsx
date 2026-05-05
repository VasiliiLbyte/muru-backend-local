import { ProductCard } from '../components/ProductCard'
import type { CatalogProduct } from '../types/catalog'

type CatalogProductsPageProps = {
  title: string
  products: CatalogProduct[]
}

export const CatalogProductsPage = ({ title, products }: CatalogProductsPageProps) => {
  return (
    <section>
      <h1 className="catalog-page-title">{title}</h1>
      <div className="products-grid">
        {products.map((product) => (
          <ProductCard key={product.sku} product={product} />
        ))}
      </div>
      {products.length === 0 ? <p className="empty-note">Товары не найдены.</p> : null}
    </section>
  )
}
