import { useRef, useState } from 'react'

import { uploadImage } from '../../lib/content-api'
import type { ContentImage } from '../../types/content'

type ImageUploadFieldProps = {
  label: string
  value: ContentImage | null
  onChange: (image: ContentImage | null) => void
}

export const ImageUploadField = ({ label, value, onChange }: ImageUploadFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')

    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    try {
      const uploaded = await uploadImage(file)
      onChange(uploaded)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
      onChange(null)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onRemove = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    onChange(null)
    setError('')
  }

  const displayUrl = previewUrl ?? value?.url ?? null

  return (
    <div className="image-upload-field">
      <span className="field-label">{label}</span>
      {displayUrl ? (
        <div className="image-preview-wrap">
          <img src={displayUrl} alt={value?.alt ?? ''} className="image-preview" />
          <button type="button" className="secondary-button" onClick={onRemove}>
            Удалить
          </button>
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onFileChange}
        disabled={uploading}
      />
      {uploading ? <p className="muted-text">Загрузка...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {value?.url ? <p className="muted-text image-url">{value.url}</p> : null}
    </div>
  )
}
