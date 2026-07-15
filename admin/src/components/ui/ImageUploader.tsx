import { ImagePlus, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '../../lib/cn'
import { IconButton } from './IconButton'

export type ImageUploaderProps = {
  label?: string
  value?: string | null
  disabled?: boolean
  uploading?: boolean
  error?: string
  onUpload: (file: File) => Promise<void>
  onRemove?: () => void
  accept?: string
  className?: string
}

export const ImageUploader = ({
  label,
  value,
  disabled = false,
  uploading = false,
  error,
  onUpload,
  onRemove,
  accept = 'image/jpeg,image/png,image/webp',
  className,
}: ImageUploaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)

  const previewUrl = value ?? localPreview

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    }
  }, [localPreview])

  const processFile = async (file: File) => {
    if (disabled || uploading) return
    const objectUrl = URL.createObjectURL(file)
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return objectUrl
    })
    try {
      await onUpload(file)
    } catch {
      setLocalPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await processFile(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    await processFile(file)
  }

  const onReplace = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  const onDelete = () => {
    if (disabled || uploading) return
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    onRemove?.()
  }

  return (
    <div className={cn('muru-image-uploader', className)}>
      {label ? <span className="muru-field__label">{label}</span> : null}

      {previewUrl ? (
        <div className="muru-image-uploader__preview">
          <img src={previewUrl} alt="" className="muru-image-uploader__img" />
          <div className="muru-image-uploader__overlay">
            <IconButton
              aria-label="Заменить изображение"
              title="Заменить"
              disabled={disabled || uploading}
              onClick={onReplace}
            >
              <Upload size={18} />
            </IconButton>
            {onRemove ? (
              <IconButton
                variant="danger"
                aria-label="Удалить изображение"
                title="Удалить"
                disabled={disabled || uploading}
                onClick={onDelete}
              >
                <Trash2 size={18} />
              </IconButton>
            ) : null}
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={cn(
            'muru-image-uploader__dropzone',
            dragOver && 'muru-image-uploader__dropzone--active',
          )}
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => void onDrop(e)}
        >
          <ImagePlus size={24} aria-hidden />
          <span>{uploading ? 'Загрузка…' : 'Нажмите или перетащите изображение'}</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="muru-image-uploader__input"
        onChange={(e) => void onFileChange(e)}
        disabled={disabled || uploading}
        tabIndex={-1}
      />

      {error ? <p className="muru-field__error">{error}</p> : null}
    </div>
  )
}
