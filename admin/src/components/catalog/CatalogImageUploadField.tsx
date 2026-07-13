import { useRef, useState } from 'react'

import { uploadCatalogImage } from '../../lib/catalog-api'
import type { CrmCatalogImageUpload } from '../../types/catalog'

type CatalogImageUploadFieldProps = {
  label: string
  disabled?: boolean
  onSuccess: (result: CrmCatalogImageUpload) => void
}

export const CatalogImageUploadField = ({
  label,
  disabled = false,
  onSuccess,
}: CatalogImageUploadFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || disabled) return

    setUploading(true)
    setError('')

    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    try {
      const uploaded = await uploadCatalogImage(file)
      onSuccess(uploaded)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить изображение'
      setError(message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onClearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setError('')
  }

  const displayUrl = previewUrl

  return (
    <div className="image-upload-field">
      <span className="field-label">{label}</span>
      {displayUrl ? (
        <div className="image-preview-wrap">
          <img src={displayUrl} alt="" className="image-preview" />
          <button type="button" className="secondary-button" onClick={onClearPreview}>
            Скрыть превью
          </button>
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onFileChange}
        disabled={uploading || disabled}
      />
      {uploading ? <p className="muted-text">Загрузка...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  )
}
