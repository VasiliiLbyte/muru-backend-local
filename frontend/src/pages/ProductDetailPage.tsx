import { useMemo } from 'react'

import type { CatalogProductDetail } from '../types/catalog'
import { ColorDots } from '../components/ColorDots'
import { ProductImageCarousel } from '../components/ProductImageCarousel'
import { formatPrice } from '../lib/format'
import { hapticImpact } from '../lib/haptics'
import { pressable, cardSurface } from '../lib/uiClasses'

type ProductDetailPageProps = {
  product: CatalogProductDetail
  onAddToCart: (product: CatalogProductDetail) => void
  onNotifyRestock: (product: CatalogProductDetail) => void
  onToggleFavorite: (product: CatalogProductDetail) => void
  isFavorite: boolean
  isAuthorized: boolean
}

const dotColors = (product: CatalogProductDetail) =>
  product.colorTags?.length ? product.colorTags : product.colors

export const ProductDetailPage = ({
  product,
  onAddToCart,
  onNotifyRestock,
  onToggleFavorite,
  isFavorite,
  isAuthorized,
}: ProductDetailPageProps) => {
  const specEntries = useMemo(() => Object.entries(product.specs || {}), [product.specs])
  const colors = dotColors(product)

  return (
    <section className="space-y-4">
      <div className={`${cardSurface} p-3`}>
        <ProductImageCarousel
          key={product.sku}
          images={product.imageUrls}
          alt={product.name}
          imageClassName="aspect-square w-full rounded-xl bg-[#efe8d8]"
          priority
        />
      </div>

      <div className={`${cardSurface} p-4`}>
        <div className="flex items-start justify-between gap-2">
          <h1 className="font-muru-display text-[1.45rem] font-medium leading-snug tracking-[0.01em] text-muru-olive">
            {product.name}
          </h1>
          <button
            type="button"
            className={`${pressable} rounded-full bg-[#efe8d8] p-2.5`}
            onClick={() => {
              hapticImpact('light')
              onToggleFavorite(product)
            }}
            aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
            aria-pressed={isFavorite}
          >
            <svg
              className="h-6 w-6 text-muru-olive"
              viewBox="0 0 24 24"
              fill={isFavorite ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <path
                d="M12 21s-7-4.35-7-10a5 5 0 0 1 9.5-2 5 5 0 0 1 9.5 2c0 5.65-7 10-7 10z"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-lg font-semibold">{formatPrice(product.price)}</p>
        {product.inStock > 0 ? null : (
          <span className="mt-1 inline-block rounded-full bg-[#efe8d8] px-2.5 py-1 text-xs tracking-wide text-[#8a7a52]">
            Под заказ
          </span>
        )}
        <p className="mt-3 text-sm">{product.description || 'Описание будет добавлено позже.'}</p>

        {product.color || product.dimensionsLabel ? (
          <div className="mt-3 grid gap-2">
            {product.color ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-muru-olive">Цвет:</span>
                <span>{product.color}</span>
                <ColorDots colors={colors} />
              </div>
            ) : null}
            {product.dimensionsLabel ? (
              <div className="flex items-baseline gap-2 text-sm">
                <span className="font-medium text-muru-olive">Размер:</span>
                <span>{product.dimensionsLabel} см</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {specEntries.length > 0 ? (
          <div className="mt-4">
            <h2 className="text-sm font-medium tracking-wide text-muru-olive">Характеристики</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {specEntries.map(([key, value]) => (
                <li key={key}>
                  <span className="font-medium">{key}:</span> {String(value)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {product.variants.length > 0 ? (
          <div className="mt-4">
            <h2 className="text-sm font-medium tracking-wide text-muru-olive">Варианты</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {product.variants.map((variant, idx) => (
                <li key={`${variant.color ?? 'no-color'}-${variant.size ?? 'no-size'}-${idx}`}>
                  Цвет: {variant.color ?? '-'}, Размер: {variant.size ?? '-'}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <button
          type="button"
          className={`${pressable} mt-5 w-full rounded-xl bg-muru-olive-soft px-4 py-2.5 text-sm font-medium tracking-wide text-muru-ivory`}
          onClick={() => (product.inStock > 0 ? onAddToCart(product) : onNotifyRestock(product))}
        >
          {product.inStock > 0 ? 'В корзину' : 'Сообщить о поступлении'}
        </button>
        {!isAuthorized ? <p className="mt-2 text-xs text-[#8f2b2b]">Для избранного нужна авторизация в Telegram.</p> : null}
      </div>
    </section>
  )
}
