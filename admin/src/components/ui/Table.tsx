import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { cn } from '../../lib/cn'

type TableProps = HTMLAttributes<HTMLTableElement> & { children: ReactNode }

export const Table = ({ className, children, ...props }: TableProps) => (
  <div className="muru-table-wrap">
    <table className={cn('muru-table', className)} {...props}>
      {children}
    </table>
  </div>
)

type TableHeaderProps = HTMLAttributes<HTMLTableSectionElement> & {
  children: ReactNode
  sticky?: boolean
}

export const TableHeader = ({ className, children, sticky, ...props }: TableHeaderProps) => (
  <thead
    className={cn('muru-table__header', sticky && 'muru-table__header--sticky', className)}
    {...props}
  >
    {children}
  </thead>
)

type TableBodyProps = HTMLAttributes<HTMLTableSectionElement> & { children: ReactNode }

export const TableBody = ({ className, children, ...props }: TableBodyProps) => (
  <tbody className={cn('muru-table__body', className)} {...props}>
    {children}
  </tbody>
)

type TableRowProps = HTMLAttributes<HTMLTableRowElement> & {
  children: ReactNode
  hover?: boolean
}

export const TableRow = ({ className, children, hover = true, ...props }: TableRowProps) => (
  <tr className={cn('muru-table__row', hover && 'muru-table__row--hover', className)} {...props}>
    {children}
  </tr>
)

type TableHeadProps = ThHTMLAttributes<HTMLTableCellElement> & {
  children?: ReactNode
  numeric?: boolean
  sortable?: boolean
  sortKey?: string
  activeSort?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
}

export const TableHead = ({
  className,
  children,
  numeric,
  sortable,
  sortKey,
  activeSort,
  sortDir,
  onSort,
  ...props
}: TableHeadProps) => {
  const isActive = sortable && sortKey && activeSort === sortKey
  const ariaSort = isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'

  const SortIcon = isActive
    ? sortDir === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown

  if (sortable && sortKey && onSort) {
    return (
      <th
        className={cn(
          'muru-table__head',
          'muru-table__head--sortable',
          numeric && 'muru-table__head--numeric',
          className,
        )}
        {...props}
      >
        <button
          type="button"
          className="muru-table__sort-btn"
          aria-sort={ariaSort}
          onClick={() => onSort(sortKey)}
        >
          <span>{children}</span>
          <SortIcon className="muru-table__sort-icon" size={14} aria-hidden />
        </button>
      </th>
    )
  }

  return (
    <th
      className={cn('muru-table__head', numeric && 'muru-table__head--numeric', className)}
      {...props}
    >
      {children ?? <span className="sr-only">Действия</span>}
    </th>
  )
}

type TableCellProps = TdHTMLAttributes<HTMLTableCellElement> & {
  children: ReactNode
  numeric?: boolean
}

export const TableCell = ({ className, children, numeric, ...props }: TableCellProps) => (
  <td className={cn('muru-table__cell', numeric && 'muru-table__cell--numeric', className)} {...props}>
    {children}
  </td>
)

type TableActionsProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode }

export const TableActions = ({ className, children, ...props }: TableActionsProps) => (
  <div className={cn('muru-table__actions', className)} {...props}>
    {children}
  </div>
)
