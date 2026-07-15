import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '../../lib/cn'

type IconButtonVariant = 'ghost' | 'danger'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: IconButtonVariant
  'aria-label': string
  children: ReactNode
}

export const IconButton = ({
  variant = 'ghost',
  className,
  children,
  type = 'button',
  ...props
}: IconButtonProps) => (
  <button
    type={type}
    className={cn('muru-icon-btn', `muru-icon-btn--${variant}`, className)}
    {...props}
  >
    {children}
  </button>
)
