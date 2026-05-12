import { useMemo, useState } from 'react'

import type { CatalogProductDetail } from '../types/catalog'
import { SmartImage } from '../components/SmartImage'

type ProductDetailPageProps = {
  product: CatalogProductDetail
  onAddToCart: (product: CatalogProductDetail) => void
  onNotifyRestock: (product: CatalogProductDetail) => void
  onToggleFavorite: (product: CatalogProductDetail) => void
  isFavorite: boolean
  isAuthorized: boolean
}

export const ProductDetailPage = ({
  product,
  onAddToCart,
  onNotifyRestock,
  onToggleFavorite,
  isFavorite,
  isAuthorized,
}: ProductDetailPageProps) => {
  const [imageIndex, setImageIndex] = useState(0)
  const specEntries = useMemo(() => Object.entries(product.specs || {}), [product.specs])
  const images = useMemo(
    () => (product.imageUrls.length > 0 ? product.imageUrls : ['https://placehold.co/1200x1200?text=MURU']),
    [product.imageUrls],
  )
  const safeImageIndex = Math.min(imageIndex, images.length - 1)

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-3">
        <SmartImage
          src={images[safeImageIndex]}
          alt={product.name}
          className="aspect-square w-full rounded-xl bg-[#efe8d8] object-cover"
        />
        <div className="mt-2 flex justify-center gap-1">
          {images.map((_, idx) => (
            <button
              key={`${product.sku}-detail-${idx}`}
              type="button"
              className={`h-2 w-2 rounded-full ${idx === safeImageIndex ? 'bg-muru-olive' : 'bg-muru-accent'}`}
              onClick={() => setImageIndex(idx)}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-semibold text-muru-olive">{product.name}</h1>
          <button
            type="button"
            className={`rounded-full px-3 py-2 text-2xl ${isFavorite ? 'bg-[#fde2e2]' : 'bg-[#efe8d8]'}`}
            onClick={() => onToggleFavorite(product)}
            aria-label="Добавить в избранное"
          >
            {isFavorite ? '❤️' : '🤍'}
          </button>
        </div>
        <p className="mt-2 text-lg font-semibold">{product.price.toFixed(2)} ₽</p>
        <p className={`mt-1 text-sm ${product.inStock > 0 ? 'text-green-700' : 'text-amber-700'}`}>
          {product.inStock > 0 ? 'В наличии' : 'Под заказ'}
        </p>
        <p className="mt-3 text-sm">{product.description || 'Описание будет добавлено позже.'}</p>

        {specEntries.length > 0 ? (
          <div className="mt-4">
            <h2 className="text-sm font-semibold text-muru-olive">Характеристики</h2>
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
            <h2 className="text-sm font-semibold text-muru-olive">Варианты</h2>
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
          className="mt-5 w-full rounded-xl bg-muru-olive px-4 py-3 text-sm font-medium text-muru-ivory"
          onClick={() => (product.inStock > 0 ? onAddToCart(product) : onNotifyRestock(product))}
        >
          {product.inStock > 0 ? 'В корзину' : 'Сообщить о поступлении'}
        </button>
        {!isAuthorized ? <p className="mt-2 text-xs text-[#8f2b2b]">Для избранного нужна авторизация в Telegram.</p> : null}
      </div>
    </section>
  )
}
