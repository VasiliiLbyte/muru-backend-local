import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'

import type { ProductImageSlot } from '../../types/catalog'
import { IconButton } from '../ui/IconButton'
import { CatalogImageUploadField } from './CatalogImageUploadField'

const MAX_IMAGES = 3

const imagePreviewSrc = (slot: ProductImageSlot): string => slot.proxyPath || slot.url

type ProductImagesEditorProps = {
  value: ProductImageSlot[]
  onChange: (images: ProductImageSlot[]) => void
  disabled?: boolean
}

export const ProductImagesEditor = ({ value, onChange, disabled = false }: ProductImagesEditorProps) => {
  const onUpload = (result: { url: string; proxyPath: string }) => {
    if (value.length >= MAX_IMAGES) return
    onChange([...value, { url: result.url, proxyPath: result.proxyPath }])
  }

  const onRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const onMove = (index: number, direction: -1 | 1) => {
    const next = index + direction
    if (next < 0 || next >= value.length) return
    const copy = [...value]
    const temp = copy[index]
    copy[index] = copy[next]
    copy[next] = temp
    onChange(copy)
  }

  return (
    <div className="product-images-editor">
      {value.map((slot, index) => (
        <div key={`${slot.url}-${index}`} className="product-image-slot-card">
          <img src={imagePreviewSrc(slot)} alt="" className="product-image-slot-card__img" />
          <div className="product-image-slot-card__overlay">
            <IconButton
              aria-label="Переместить вверх"
              title="Вверх"
              disabled={disabled || index === 0}
              onClick={() => onMove(index, -1)}
            >
              <ArrowUp size={18} />
            </IconButton>
            <IconButton
              aria-label="Переместить вниз"
              title="Вниз"
              disabled={disabled || index === value.length - 1}
              onClick={() => onMove(index, 1)}
            >
              <ArrowDown size={18} />
            </IconButton>
            <IconButton
              variant="danger"
              aria-label="Удалить фото"
              title="Удалить"
              disabled={disabled}
              onClick={() => onRemove(index)}
            >
              <Trash2 size={18} />
            </IconButton>
          </div>
        </div>
      ))}

      {value.length < MAX_IMAGES ? (
        <CatalogImageUploadField
          label={`Добавить фото (${value.length}/${MAX_IMAGES})`}
          disabled={disabled}
          onSuccess={onUpload}
        />
      ) : (
        <p className="muted-text">Достигнут лимит в 3 фото.</p>
      )}
    </div>
  )
}
