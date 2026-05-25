import type { CatalogProduct } from '../types/catalog'
import { pressable } from '../lib/uiClasses'
import { ProductImageCarousel } from './ProductImageCarousel'

type ProductCardProps = {
  product: CatalogProduct
  onOpenDetail: (sku: string) => void
  onAddToCart: (product: CatalogProduct) => void
  onNotifyRestock: (product: CatalogProduct) => void
}

export const ProductCard = ({ product, onOpenDetail, onAddToCart, onNotifyRestock }: ProductCardProps) => {
  return (
    <article className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-3 shadow-sm">
      <ProductImageCarousel
        key={product.sku}
        images={product.imageUrls}
        alt={product.name}
        onImageActivate={() => onOpenDetail(product.sku)}
      />
      <h3 className="mt-2 line-clamp-2 min-h-10 text-sm font-medium">{product.name}</h3>
      <p className="mt-1 text-sm font-semibold">{product.price.toFixed(2)} ₽</p>
      <p className={`mt-1 text-xs ${product.inStock > 0 ? 'text-green-700' : 'text-amber-700'}`}>
        {product.inStock > 0 ? 'В наличии' : 'Под заказ'}
      </p>
      <button
        type="button"
        className={`${pressable} mt-2 w-full rounded-xl bg-muru-olive px-3 py-2 text-sm font-medium text-muru-ivory`}
        onClick={() => (product.inStock > 0 ? onAddToCart(product) : onNotifyRestock(product))}
      >
        {product.inStock > 0 ? 'В корзину' : 'Сообщить о поступлении'}
      </button>
    </article>
  )
}
