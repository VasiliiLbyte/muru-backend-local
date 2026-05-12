import { pressable } from '../lib/uiClasses'

type ExitConfirmModalProps = {
  isOpen: boolean
  title?: string
  message: string
  cancelLabel?: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
}

export const ExitConfirmModal = ({
  isOpen,
  title = 'Внимание',
  message,
  cancelLabel = 'Отмена',
  confirmLabel = 'Закрыть всё равно',
  onCancel,
  onConfirm,
}: ExitConfirmModalProps) => {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-confirm-title"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-sm rounded-xl border border-muru-accent bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="exit-confirm-title" className="text-base font-semibold text-muru-text">
            {title}
          </h2>
          <button
            type="button"
            className={`${pressable} -mr-1 -mt-1 rounded-lg p-1.5 text-lg leading-none text-[#9a9090] hover:text-muru-text`}
            onClick={onCancel}
            aria-label="Закрыть окно"
          >
            ×
          </button>
        </div>
        <p className="mt-3 text-sm text-[#4f4545]">{message}</p>
        <div className="mt-6 flex justify-end gap-4">
          <button type="button" className={`${pressable} text-sm font-medium text-blue-600`} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${pressable} text-sm font-semibold text-[#8f2b2b]`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
