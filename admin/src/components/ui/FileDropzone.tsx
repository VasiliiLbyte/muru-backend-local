import { FileUp } from 'lucide-react'
import { useRef, useState } from 'react'

import { cn } from '../../lib/cn'

type FileDropzoneProps = {
  label?: string
  accept?: string
  fileName?: string | null
  disabled?: boolean
  onFileSelect: (file: File) => void
  className?: string
}

export const FileDropzone = ({
  label,
  accept = '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv',
  fileName,
  disabled = false,
  onFileSelect,
  className,
}: FileDropzoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (file: File) => {
    onFileSelect(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className={cn('muru-file-dropzone', className)}>
      {label ? <span className="muru-field__label">{label}</span> : null}
      <button
        type="button"
        className={cn(
          'muru-file-dropzone__zone',
          dragOver && 'muru-file-dropzone__zone--active',
        )}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files?.[0]
          if (file) handleFile(file)
        }}
      >
        <FileUp size={24} aria-hidden />
        <span>{fileName ?? 'Выберите или перетащите файл'}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="muru-file-dropzone__input"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
        tabIndex={-1}
      />
    </div>
  )
}
