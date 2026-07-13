import type { ProductImageSlot } from '../../types/catalog'
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
        <div key={`${slot.url}-${index}`} className="product-image-slot">
          <img src={imagePreviewSrc(slot)} alt="" className="image-preview" />
          <div className="product-image-slot-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={disabled || index === 0}
              onClick={() => onMove(index, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={disabled || index === value.length - 1}
              onClick={() => onMove(index, 1)}
            >
              ↓
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={disabled}
              onClick={() => onRemove(index)}
            >
              Удалить
            </button>
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
