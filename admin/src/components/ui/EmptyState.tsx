import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) => (
  <div className={cn('muru-empty-state', className)}>
    <Icon className="muru-empty-state__icon" aria-hidden />
    <h3 className="muru-empty-state__title">{title}</h3>
    {description ? <p className="muru-empty-state__description">{description}</p> : null}
    {action ? <div className="muru-empty-state__action">{action}</div> : null}
  </div>
)
