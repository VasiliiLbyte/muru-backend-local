import { useMemo, useState } from 'react'

import type { CatalogProductDetail } from '../types/catalog'

type ProductDetailPageProps = {
  product: CatalogProductDetail
}

export const ProductDetailPage = ({ product }: ProductDetailPageProps) => {
  const [imageIndex, setImageIndex] = useState(0)
  const specEntries = useMemo(() => Object.entries(product.specs || {}), [product.specs])

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-3">
        <img
          src={product.imageUrls[imageIndex]}
          alt={product.name}
          className="aspect-square w-full rounded-xl bg-[#efe8d8] object-cover"
        />
        <div className="mt-2 flex justify-center gap-1">
          {product.imageUrls.map((_, idx) => (
            <button
              key={`${product.sku}-detail-${idx}`}
              type="button"
              className={`h-2 w-2 rounded-full ${idx === imageIndex ? 'bg-muru-olive' : 'bg-muru-accent'}`}
              onClick={() => setImageIndex(idx)}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
        <h1 className="text-xl font-semibold text-muru-olive">{product.name}</h1>
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
        >
          В корзину
        </button>
      </div>
    </section>
  )
}
