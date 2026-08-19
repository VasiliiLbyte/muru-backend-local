import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  FolderTree,
  LayoutGrid,
  Package,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'

import { Badge, Card, PageHeader, SkeletonText } from '../components/ui'
import { countActiveOrders } from '../constants/order-statuses'
import { useAuth } from '../context/AuthContext'
import { listOrders } from '../lib/orders-api'

const dashboardLinks = [
  {
    to: '/catalog',
    icon: FolderTree,
    title: 'Каталог и разделы',
    hint: 'Категории, подкатегории, контентные разделы',
  },
  {
    to: '/catalog/products',
    icon: Package,
    title: 'Товары',
    hint: 'Список и редактирование товаров',
  },
  {
    to: '/orders',
    icon: ShoppingBag,
    title: 'Заказы',
    hint: 'Обработка заказов и статусов',
  },
  {
    to: '/content',
    icon: LayoutGrid,
    title: 'Контент',
    hint: 'Страницы и баннеры',
  },
  {
    to: '/catalog/sections/inspiration',
    icon: Sparkles,
    title: 'Вдохновение',
    hint: 'Лукбуки и точки на баннере',
  },
] as const

export const DashboardPage = () => {
  const { admin } = useAuth()
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [activeLoading, setActiveLoading] = useState(true)

  useEffect(() => {
    listOrders({ page: 1, pageSize: 1 })
      .then((data) => setActiveCount(countActiveOrders(data.statusCounts)))
      .catch(() => setActiveCount(null))
      .finally(() => setActiveLoading(false))
  }, [])

  return (
    <section className="page-stack muru-rise">
      <PageHeader title="Дашборд" />

      {admin ? (
        <div className="dashboard-greeting">
          <span>{admin.email}</span>
          <Badge variant="neutral">{admin.role}</Badge>
        </div>
      ) : null}

      <Card title="Активные заказы">
        <div className="dashboard-active-orders">
          {activeLoading ? (
            <SkeletonText lines={1} />
          ) : (
            <span className="dashboard-active-orders__count">{activeCount ?? '—'}</span>
          )}
          <p className="muted-text">Новый + Собирается + В пути</p>
          <Link className="dashboard-active-orders__link" to="/orders">
            Перейти к заказам →
          </Link>
        </div>
      </Card>

      <div className="dashboard-grid">
        {dashboardLinks.map((item) => (
          <Link key={item.to} className="dashboard-card" to={item.to}>
            <item.icon className="dashboard-card__icon" size={28} aria-hidden />
            <h2 className="dashboard-card__title">{item.title}</h2>
            <p className="dashboard-card__hint">{item.hint}</p>
          </Link>
        ))}
      </div>

      <p className="muted-text">
        <BookOpen size={14} aria-hidden /> Быстрый доступ к основным разделам admin.
      </p>
    </section>
  )
}
