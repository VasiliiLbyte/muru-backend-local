import { X } from 'lucide-react'

import { cn } from '../../lib/cn'

export type ToastItem = {
  id: string
  message: string
  variant: 'success' | 'error'
}

type ToastStackProps = {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

export const ToastStack = ({ toasts, onDismiss }: ToastStackProps) => {
  if (toasts.length === 0) return null

  return (
    <div className="muru-toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn('muru-toast', `muru-toast--${toast.variant}`)}
          role="status"
        >
          <span className="muru-toast__message">{toast.message}</span>
          <button
            type="button"
            className="muru-toast__dismiss"
            aria-label="Закрыть"
            onClick={() => onDismiss(toast.id)}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  )
}
