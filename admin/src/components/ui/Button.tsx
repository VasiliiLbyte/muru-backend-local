import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  loading?: boolean
  fullWidth?: boolean
}

export const Button = ({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) => (
  <button
    type="button"
    className={cn(
      'muru-btn',
      `muru-btn--${variant}`,
      loading && 'muru-btn--loading',
      fullWidth && 'muru-btn--full',
      className,
    )}
    disabled={disabled || loading}
    {...props}
  >
    {loading ? <span className="muru-btn__spinner" aria-hidden /> : null}
    {children}
  </button>
)
