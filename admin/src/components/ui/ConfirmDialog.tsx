import { useEffect } from 'react'

import { Button } from './Button'
import { cn } from '../../lib/cn'

export type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
}

type ConfirmDialogProps = {
  open: boolean
  options: ConfirmOptions | null
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog = ({ open, options, onConfirm, onCancel }: ConfirmDialogProps) => {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open || !options) return null

  return (
    <div className="muru-confirm-overlay" role="presentation" onClick={onCancel}>
      <div
        className="muru-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="muru-confirm-title"
        aria-describedby="muru-confirm-message"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="muru-confirm-title" className="muru-confirm-dialog__title">
          {options.title}
        </h2>
        <p id="muru-confirm-message" className="muru-confirm-dialog__message">
          {options.message}
        </p>
        <div className="muru-confirm-dialog__actions">
          <Button variant="secondary" onClick={onCancel}>
            {options.cancelLabel ?? 'Отмена'}
          </Button>
          <Button
            variant={options.variant === 'danger' ? 'danger' : 'primary'}
            className={cn(options.variant === 'danger' && 'muru-confirm-dialog__confirm-danger')}
            onClick={onConfirm}
          >
            {options.confirmLabel ?? 'Подтвердить'}
          </Button>
        </div>
      </div>
    </div>
  )
}
