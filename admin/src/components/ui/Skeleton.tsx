import { cn } from '../../lib/cn'

type SkeletonProps = {
  className?: string
  style?: React.CSSProperties
}

export const Skeleton = ({ className, style }: SkeletonProps) => (
  <div className={cn('muru-skeleton', className)} style={style} aria-hidden />
)

type SkeletonTextProps = {
  lines?: number
  className?: string
}

export const SkeletonText = ({ lines = 3, className }: SkeletonTextProps) => (
  <div className={cn('muru-skeleton-text', className)} aria-hidden>
    {Array.from({ length: lines }, (_, i) => (
      <Skeleton key={i} className="muru-skeleton-text__line" />
    ))}
  </div>
)

type SkeletonTableProps = {
  rows?: number
  cols?: number
  className?: string
}

export const SkeletonTable = ({ rows = 5, cols = 4, className }: SkeletonTableProps) => (
  <div className={cn('muru-skeleton-table', className)} aria-hidden>
    {Array.from({ length: rows }, (_, row) => (
      <div key={row} className="muru-skeleton-table__row">
        {Array.from({ length: cols }, (_, col) => (
          <Skeleton key={col} className="muru-skeleton-table__cell" />
        ))}
      </div>
    ))}
  </div>
)

export const SkeletonForm = ({ className }: { className?: string }) => (
  <div className={cn('muru-skeleton-form', className)} aria-hidden>
    <Skeleton className="muru-skeleton-form__title" />
    <SkeletonText lines={4} />
    <Skeleton className="muru-skeleton-form__block" />
    <SkeletonText lines={2} />
  </div>
)
