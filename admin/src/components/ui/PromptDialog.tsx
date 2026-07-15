import { useEffect, useRef, useState } from 'react'

import { Button } from './Button'
import { Field } from './Field'
import { Input } from './Input'

export type PromptOptions = {
  title: string
  message?: string
  defaultValue?: string
  confirmLabel?: string
  cancelLabel?: string
}

type PromptDialogProps = {
  open: boolean
  options: PromptOptions | null
  onConfirm: (value: string) => void
  onCancel: () => void
}

export const PromptDialog = ({ open, options, onConfirm, onCancel }: PromptDialogProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    if (!open || !options) return
    setValue(options.defaultValue ?? '')
    const timer = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [open, options])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open || !options) return null

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onConfirm(value)
  }

  return (
    <div className="muru-prompt-overlay" role="presentation" onClick={onCancel}>
      <form
        className="muru-prompt-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="muru-prompt-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <h2 id="muru-prompt-title" className="muru-prompt-dialog__title">
          {options.title}
        </h2>
        {options.message ? (
          <p className="muru-prompt-dialog__message">{options.message}</p>
        ) : null}
        <Field label="Значение" htmlFor="muru-prompt-input">
          <Input
            ref={inputRef}
            id="muru-prompt-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        <div className="muru-prompt-dialog__actions">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {options.cancelLabel ?? 'Отмена'}
          </Button>
          <Button type="submit">{options.confirmLabel ?? 'OK'}</Button>
        </div>
      </form>
    </div>
  )
}
