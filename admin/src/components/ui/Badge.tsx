import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger'

type BadgeProps = {
  variant?: BadgeVariant
  dot?: boolean
  children: ReactNode
  className?: string
}

export const Badge = ({ variant = 'neutral', dot = false, children, className }: BadgeProps) => (
  <span className={cn('muru-badge', `muru-badge--${variant}`, className)}>
    {dot ? <span className="muru-badge__dot" aria-hidden /> : null}
    {children}
  </span>
)
