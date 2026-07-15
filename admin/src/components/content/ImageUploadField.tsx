import { useState } from 'react'

import { uploadImage } from '../../lib/content-api'
import type { ContentImage } from '../../types/content'
import { ImageUploader } from '../ui/ImageUploader'

type ImageUploadFieldProps = {
  label: string
  value: ContentImage | null
  onChange: (image: ContentImage | null) => void
}

export const ImageUploadField = ({ label, value, onChange }: ImageUploadFieldProps) => {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const onUpload = async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const uploaded = await uploadImage(file)
      onChange(uploaded)
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
      value={value?.url ?? null}
      uploading={uploading}
      error={error}
      onUpload={onUpload}
      onRemove={() => onChange(null)}
    />
  )
}
