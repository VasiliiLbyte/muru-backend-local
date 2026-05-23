export type AdminSectionId =
  | 'orders'
  | 'products'
  | 'categories'
  | 'customers'
  | 'promos'
  | 'sync'
  | 'settings'

export type AdminNavItem = {
  id: AdminSectionId
  label: string
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: 'orders', label: 'Заказы' },
  { id: 'products', label: 'Товары' },
  { id: 'categories', label: 'Категории и контент' },
  { id: 'customers', label: 'Клиенты' },
  { id: 'promos', label: 'Промокоды' },
  { id: 'sync', label: 'Синхронизация' },
  { id: 'settings', label: 'Настройки' },
]

export const getAdminNavLabel = (id: AdminSectionId): string =>
  ADMIN_NAV_ITEMS.find((item) => item.id === id)?.label ?? id
