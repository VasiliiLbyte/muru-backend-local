import { useMemo, useRef } from 'react'

import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { useImageCarouselSwipe } from '../hooks/useImageCarouselSwipe'
import { pressableTight } from '../lib/uiClasses'
import { SmartImage } from './SmartImage'

type ProductImageCarouselProps = {
  images: string[]
  alt: string
  imageClassName?: string
  priority?: boolean
  onImageActivate?: () => void
}

const defaultImageClass = 'aspect-square w-full rounded-xl bg-[#efe8d8] object-cover'

export const ProductImageCarousel = ({
  images,
  alt,
  imageClassName = defaultImageClass,
  priority = false,
  onImageActivate,
}: ProductImageCarouselProps) => {
  const viewportRef = useRef<HTMLDivElement>(null)

  const slideImages = useMemo(
    () => (images.length > 0 ? images : ['https://placehold.co/600x600?text=MURU']),
    [images],
  )

  const {
    index,
    setIndex,
    canSwipe,
    isInteracting,
    trackStyle,
    shouldSuppressClick,
    pointerHandlers,
  } = useImageCarouselSwipe({ count: slideImages.length, viewportRef })

  useBodyScrollLock(isInteracting && canSwipe)

  const handleClick = () => {
    if (!onImageActivate || shouldSuppressClick()) return
    onImageActivate()
  }

  const viewportStyle = canSwipe
    ? { touchAction: 'none' as const, overscrollBehavior: 'contain' as const }
    : undefined

  return (
    <div className="w-full">
      <div
        ref={viewportRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={`Фотографии: ${alt}`}
        className={`overflow-hidden rounded-xl touch-manipulation select-none ${onImageActivate ? 'cursor-pointer' : ''}`}
        style={viewportStyle}
        onClick={onImageActivate ? handleClick : undefined}
        {...pointerHandlers}
      >
        <div className="flex w-full" style={trackStyle}>
          {slideImages.map((src, idx) => (
            <div key={`${src}-${idx}`} className="min-w-full shrink-0">
              <SmartImage
                src={src}
                alt={idx === 0 ? alt : `${alt}, фото ${idx + 1}`}
                className={imageClassName}
                priority={priority && idx === index}
              />
            </div>
          ))}
        </div>
      </div>

      {canSwipe ? (
        <div className="mt-2 flex justify-center gap-1">
          {slideImages.map((_, idx) => (
            <button
              key={`dot-${idx}`}
              type="button"
              className={`${pressableTight} h-2 w-2 rounded-full ${idx === index ? 'bg-muru-olive' : 'bg-muru-accent'}`}
              onClick={() => setIndex(idx)}
              aria-label={`Фото ${idx + 1}`}
              aria-current={idx === index ? 'true' : undefined}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
