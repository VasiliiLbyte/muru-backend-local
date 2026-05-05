import { useState } from 'react'

import type { CatalogProduct } from '../types/catalog'

type ProductCardProps = {
  product: CatalogProduct
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const [imageIndex, setImageIndex] = useState(0)
  const images = product.imageUrls

  return (
    <article className="product-card">
      <div className="product-card__image-wrap">
        <img src={images[imageIndex]} alt={product.name} className="product-card__image" />
        <div className="carousel-dots">
          {images.map((_, idx) => (
            <button
              key={`${product.sku}-${idx}`}
              type="button"
              className={`carousel-dot ${idx === imageIndex ? 'active' : ''}`}
              onClick={() => setImageIndex(idx)}
              aria-label={`Фото ${idx + 1}`}
            />
          ))}
        </div>
      </div>
      <h3>{product.name}</h3>
      <p className="product-price">{product.price.toFixed(2)} ₽</p>
      <p className={`stock-chip ${product.inStock > 0 ? 'in-stock' : 'on-order'}`}>
        {product.inStock > 0 ? 'В наличии' : 'Под заказ'}
      </p>
      <button type="button" className="primary-btn product-btn">
        В корзину
      </button>
    </article>
  )
}
