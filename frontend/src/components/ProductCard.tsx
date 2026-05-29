import type { CatalogProduct } from '../types/catalog'
import { formatPrice } from '../lib/format'
import { pressable, cardSurface } from '../lib/uiClasses'
import { ColorDots } from './ColorDots'
import { ProductImageCarousel } from './ProductImageCarousel'

type ProductCardProps = {
  product: CatalogProduct
  index?: number
  onOpenDetail: (sku: string) => void
  onAddToCart: (product: CatalogProduct) => void
  onNotifyRestock: (product: CatalogProduct) => void
}

const dotColors = (product: CatalogProduct) =>
  product.colorTags?.length ? product.colorTags : product.colors

export const ProductCard = ({
  product,
  index = 0,
  onOpenDetail,
  onAddToCart,
  onNotifyRestock,
}: ProductCardProps) => {
  const colors = dotColors(product)

  return (
    <article
      className={`${cardSurface} muru-rise p-3`}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <ProductImageCarousel
        key={product.sku}
        images={product.imageUrls}
        alt={product.name}
        onImageActivate={() => onOpenDetail(product.sku)}
      />
      <h3 className="mt-2 line-clamp-2 min-h-10 text-sm font-medium">{product.name}</h3>
      <p className="mt-0.5 text-[11px] tracking-wide text-[#7a7165]">{product.sku}</p>
      {colors.length > 0 ? (
        <div className="mt-1 flex items-center gap-1">
          <ColorDots colors={colors} />
        </div>
      ) : null}
      {product.dimensionsLabel ? (
        <p className="text-[11px] text-[#6b6b4a]">{product.dimensionsLabel} см</p>
      ) : null}
      <p className="mt-1 text-sm font-semibold">{formatPrice(product.price)}</p>
      <p className={`mt-1 text-xs ${product.inStock > 0 ? 'text-green-700' : 'text-amber-700'}`}>
        {product.inStock > 0 ? 'В наличии' : 'Под заказ'}
      </p>
      <button
        type="button"
        className={`${pressable} mt-2 w-full rounded-lg bg-muru-olive-soft px-3 py-1.5 text-xs font-medium tracking-wide text-muru-ivory`}
        onClick={() => (product.inStock > 0 ? onAddToCart(product) : onNotifyRestock(product))}
      >
        {product.inStock > 0 ? 'В корзину' : 'Сообщить о поступлении'}
      </button>
    </article>
  )
}
