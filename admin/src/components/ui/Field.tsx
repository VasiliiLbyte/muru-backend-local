import type { ReactNode } from 'react'

type FieldProps = {
  label: string
  htmlFor?: string
  error?: string
  children: ReactNode
  className?: string
}

export const Field = ({ label, htmlFor, error, children, className }: FieldProps) => (
  <div className={className ? `muru-field ${className}` : 'muru-field'}>
    <label className="muru-field__label" htmlFor={htmlFor}>
      {label}
    </label>
    {children}
    {error ? <p className="muru-field__error">{error}</p> : null}
  </div>
)
