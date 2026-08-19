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

import { Badge, Card, CardHeader, PageHeader, SkeletonTable } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { listOrders } from '../lib/orders-api'
import type { CrmOrderListItem } from '../types/orders'
import { formatMoney, formatOrderDate } from '../utils/order-labels'
import { OrderStatusBadge } from '../utils/order-status-ui'

const ACTIVE_FEED_SIZE = 10

const renderCustomer = (order: CrmOrderListItem) => {
  const parts = [order.customerName, order.customerPhone].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : '—'
}

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
  const [items, setItems] = useState<CrmOrderListItem[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    listOrders({ status: 'active', page: 1, pageSize: ACTIVE_FEED_SIZE })
      .then((data) => {
        setItems(data.items)
        setTotal(data.total)
      })
      .catch(() => setError('Не удалось загрузить активные заказы'))
      .finally(() => setLoading(false))
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

      <Card>
        <CardHeader className="dashboard-active-feed__header">
          <span>Активные заказы</span>
          {!loading && total != null ? <Badge variant="neutral">{total}</Badge> : null}
        </CardHeader>

        {loading ? <SkeletonTable rows={5} cols={5} /> : null}

        {!loading && error ? <p className="muted-text">{error}</p> : null}

        {!loading && !error && items.length === 0 ? (
          <p className="muted-text">Нет активных заказов</p>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <ul className="dashboard-active-feed">
            {items.map((order) => (
              <li key={order.id} className="dashboard-active-feed__row">
                <Link to={`/orders/${order.id}`} className="dashboard-active-feed__link">
                  <span>#{order.id}</span>
                  <span>{formatOrderDate(order.createdAt)}</span>
                  <span>{renderCustomer(order)}</span>
                  <span>{formatMoney(order.total)}</span>
                  <OrderStatusBadge status={order.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="muted-text">Новый + Собирается + В пути</p>
        <Link className="dashboard-active-feed__footer" to="/orders">
          Все заказы →
        </Link>
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
