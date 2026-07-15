import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

type PageHeaderProps = {
  title: string
  backTo?: string
  backLabel?: string
  actions?: ReactNode
  className?: string
}

export const PageHeader = ({
  title,
  backTo,
  backLabel = 'Назад',
  actions,
  className,
}: PageHeaderProps) => (
  <header className={cn('muru-page-header', className)}>
    <div className="muru-page-header__main">
      {backTo ? (
        <Link className="muru-page-header__back" to={backTo}>
          <ArrowLeft size={16} aria-hidden />
          {backLabel}
        </Link>
      ) : null}
      <h1 className="muru-page-header__title muru-display">{title}</h1>
    </div>
    {actions ? <div className="muru-page-header__actions">{actions}</div> : null}
  </header>
)
