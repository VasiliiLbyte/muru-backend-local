import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

type CardProps = {
  children: ReactNode
  title?: string
  className?: string
}

export const Card = ({ children, title, className }: CardProps) => (
  <div className={cn('muru-card', className)}>
    {title ? <CardHeader>{title}</CardHeader> : null}
    {children}
  </div>
)

type CardHeaderProps = {
  children: ReactNode
  className?: string
}

export const CardHeader = ({ children, className }: CardHeaderProps) => (
  <h2 className={cn('muru-card__header', className)}>{children}</h2>
)
