import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

import { cn } from '../../lib/cn'

type TabsProps = {
  children: ReactNode
  className?: string
}

export const Tabs = ({ children, className }: TabsProps) => (
  <div className={cn('muru-tabs', className)}>{children}</div>
)

type TabsListProps = {
  children: ReactNode
  className?: string
  'aria-label'?: string
}

export const TabsList = ({ children, className, 'aria-label': ariaLabel }: TabsListProps) => (
  <div className={cn('muru-tabs__list', className)} role="tablist" aria-label={ariaLabel}>
    {children}
  </div>
)

type TabsTriggerNavProps = ComponentPropsWithoutRef<typeof NavLink>

export const TabsTrigger = ({ className, children, ...props }: TabsTriggerNavProps) => (
  <NavLink
    className={({ isActive }) => {
      const extra =
        typeof className === 'function' ? className({ isActive, isPending: false, isTransitioning: false }) : className
      return cn('muru-tabs__trigger', isActive && 'muru-tabs__trigger--active', extra)
    }}
    {...props}
  >
    {children}
  </NavLink>
)
