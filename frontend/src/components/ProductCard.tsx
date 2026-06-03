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
      className={`${cardSurface} muru-rise flex h-full flex-col p-3`}
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
      <div className="mt-1 min-h-[1.75rem]">
        {colors.length > 0 ? (
          <div className="flex items-center gap-1">
            <ColorDots colors={colors} />
          </div>
        ) : null}
        {product.dimensionsLabel ? (
          <p className="text-[11px] text-[#6b6b4a]">{product.dimensionsLabel} см</p>
        ) : null}
      </div>
      <div className="mt-1 min-h-[2.5rem]">
        {(product.discountPercent ?? 0) > 0 ? (
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className="text-sm font-semibold tabular-nums text-muru-olive">
              {formatPrice(Math.round(product.price * (1 - (product.discountPercent ?? 0) / 100) * 100) / 100)}
            </span>
            <span className="text-xs line-through tabular-nums text-[#9a7a6a]">
              {formatPrice(product.price)}
            </span>
            <span className="rounded-full bg-[#8f2b2b] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">
              −{product.discountPercent}%
            </span>
          </div>
        ) : (
          <p className="text-sm font-semibold tabular-nums">{formatPrice(product.price)}</p>
        )}
      </div>
      {product.inStock > 0 ? null : (
        <span className="mt-1 inline-block rounded-full bg-[#efe8d8] px-2 py-0.5 text-[11px] tracking-wide text-[#8a7a52]">
          Под заказ
        </span>
      )}
      <button
        type="button"
        className={`${pressable} mt-auto w-full rounded-lg bg-muru-olive-soft px-3 pb-1.5 pt-2 text-xs font-medium tracking-wide text-muru-ivory`}
        onClick={() => (product.inStock > 0 ? onAddToCart(product) : onNotifyRestock(product))}
      >
        {product.inStock > 0 ? 'В корзину' : 'Сообщить о поступлении'}
      </button>
    </article>
  )
}
