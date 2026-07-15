import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

type CardProps = {
  children: ReactNode
  title?: string
  className?: string
}

export const Card = ({ children, title, className }: CardProps) => (
  <div className={cn('muru-card', className)}>
    {title ? <h2 className="muru-card__header">{title}</h2> : null}
    {children}
  </div>
)
