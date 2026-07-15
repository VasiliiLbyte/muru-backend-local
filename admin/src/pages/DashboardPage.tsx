import { Link } from 'react-router-dom'
import {
  BookOpen,
  FolderTree,
  LayoutGrid,
  Package,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'

import { Badge, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'

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

  return (
    <section className="page-stack muru-rise">
      <PageHeader title="Дашборд" />

      {admin ? (
        <div className="dashboard-greeting">
          <span>{admin.email}</span>
          <Badge variant="neutral">{admin.role}</Badge>
        </div>
      ) : null}

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
