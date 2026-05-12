import { useMemo, useState } from 'react'

import type { CatalogProduct } from '../types/catalog'
import { pressable, pressableTight } from '../lib/uiClasses'
import { SmartImage } from './SmartImage'

type ProductCardProps = {
  product: CatalogProduct
  onOpenDetail: (sku: string) => void
  onAddToCart: (product: CatalogProduct) => void
  onNotifyRestock: (product: CatalogProduct) => void
}

export const ProductCard = ({ product, onOpenDetail, onAddToCart, onNotifyRestock }: ProductCardProps) => {
  const [imageIndex, setImageIndex] = useState(0)
  const images = useMemo(
    () => (product.imageUrls.length > 0 ? product.imageUrls : ['https://placehold.co/600x600?text=MURU']),
    [product.imageUrls],
  )
  const safeImageIndex = Math.min(imageIndex, images.length - 1)

  return (
    <article className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-3 shadow-sm">
      <button
        type="button"
        className={`${pressable} w-full text-left`}
        onClick={() => onOpenDetail(product.sku)}
      >
        <SmartImage
          src={images[safeImageIndex]}
          alt={product.name}
          className="aspect-square w-full rounded-xl bg-[#efe8d8] object-cover"
        />
      </button>
      <div className="mt-2 flex justify-center gap-1">
          {images.map((_, idx) => (
            <button
              key={`${product.sku}-${idx}`}
              type="button"
              className={`${pressableTight} h-2 w-2 rounded-full ${idx === safeImageIndex ? 'bg-muru-olive' : 'bg-muru-accent'}`}
              onClick={() => setImageIndex(idx)}
              aria-label={`Фото ${idx + 1}`}
            />
          ))}
      </div>
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
