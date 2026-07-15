import { useState } from 'react'

import { uploadCatalogImage } from '../../lib/catalog-api'
import type { CrmCatalogImageUpload } from '../../types/catalog'
import { ImageUploader } from '../ui/ImageUploader'

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
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const onUpload = async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const uploaded = await uploadCatalogImage(file)
      setPreviewUrl(uploaded.proxyPath || uploaded.url)
      onSuccess(uploaded)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить изображение'
      setError(message)
      throw err
    } finally {
      setUploading(false)
    }
  }

  return (
    <ImageUploader
      label={label}
      value={previewUrl}
      disabled={disabled}
      uploading={uploading}
      error={error}
      onUpload={onUpload}
      onRemove={() => setPreviewUrl(null)}
    />
  )
}
