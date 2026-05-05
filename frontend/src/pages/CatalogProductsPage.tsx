import { ProductCard } from '../components/ProductCard'
import type { CatalogProduct } from '../types/catalog'

type CatalogProductsPageProps = {
  title: string
  products: CatalogProduct[]
  onOpenProductDetail: (sku: string) => void
}

export const CatalogProductsPage = ({
  title,
  products,
  onOpenProductDetail,
}: CatalogProductsPageProps) => {
  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold text-muru-olive">{title}</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.sku} product={product} onOpenDetail={onOpenProductDetail} />
        ))}
      </div>
      {products.length === 0 ? <p className="text-sm">Товары не найдены.</p> : null}
    </section>
  )
}
