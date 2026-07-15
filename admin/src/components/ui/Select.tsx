import type { SelectHTMLAttributes } from 'react'

import { cn } from '../../lib/cn'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export const Select = ({ className, children, ...props }: SelectProps) => (
  <select className={cn('muru-select', className)} {...props}>
    {children}
  </select>
)
