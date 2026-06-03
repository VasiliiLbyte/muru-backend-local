import { ProductCard } from '../components/ProductCard'
import type { CatalogProduct } from '../types/catalog'

type CatalogProductsPageProps = {
  title: string
  products: CatalogProduct[]
  onOpenProductDetail: (sku: string) => void
  onAddToCart: (product: CatalogProduct) => void
  onNotifyRestock: (product: CatalogProduct) => void
  isLoading?: boolean
}

export const CatalogProductsPage = ({
  title,
  products,
  onOpenProductDetail,
  onAddToCart,
  onNotifyRestock,
  isLoading = false,
}: CatalogProductsPageProps) => {
  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold text-muru-olive">{title}</h1>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 items-stretch">
          {[...Array(6)].map((_, idx) => (
            <div key={idx} className="h-56 animate-pulse rounded-2xl bg-[#efe8d8]" />
          ))}
        </div>
      ) : null}
      {!isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 items-stretch">
          {products.map((product, i) => (
            <ProductCard
              key={product.sku}
              index={i}
              product={product}
              onOpenDetail={onOpenProductDetail}
              onAddToCart={onAddToCart}
              onNotifyRestock={onNotifyRestock}
            />
          ))}
        </div>
      ) : null}
      {!isLoading && products.length === 0 ? (
        <p className="text-sm">Товары не найдены.</p>
      ) : null}
    </section>
  )
}
