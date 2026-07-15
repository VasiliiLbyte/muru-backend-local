import type { InputHTMLAttributes, ReactNode } from 'react'

import { cn } from '../../lib/cn'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode
}

export const Checkbox = ({ label, className, id, ...props }: CheckboxProps) => (
  <label className={cn('muru-checkbox', className)} htmlFor={id}>
    <input type="checkbox" className="muru-checkbox__input" id={id} {...props} />
    <span className="muru-checkbox__box" aria-hidden />
    <span className="muru-checkbox__label">{label}</span>
  </label>
)
