import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'

import { Badge, Card, PageHeader } from '../../components/ui'

const soonItems = [
  { label: 'Реквизиты и контакты', hint: 'Сайт и документы магазина' },
  { label: 'Доставка (СДЭК)', hint: 'Адрес отправителя, тарифы, габариты' },
  { label: 'Оплата (ЮКасса / 54-ФЗ)', hint: 'Чек, НДС, параметры магазина' },
  { label: 'SEO-шаблоны', hint: 'Мета-теги товаров и категорий' },
  { label: 'Юридические документы', hint: 'Оферта, политика, согласие 152-ФЗ' },
  { label: 'Уведомления', hint: 'Telegram, email, шаблоны' },
] as const

export const SettingsHubPage = () => (
  <section className="page-stack">
    <PageHeader title="Настройки" />

    <Card title="Разделы">
      <div className="section-links-grid">
        <Link className="section-link-card" to="/settings/users">
          <span className="section-link-card__title">
            <Users size={16} aria-hidden /> Пользователи и роли
          </span>
          <span className="section-link-card__hint">Владельцы и менеджеры CRM</span>
        </Link>

        {soonItems.map((item) => (
          <div key={item.label} className="section-link-card" aria-disabled>
            <span className="section-link-card__title">
              {item.label}{' '}
              <Badge variant="neutral" className="inline-badge">
                скоро
              </Badge>
            </span>
            <span className="section-link-card__hint">{item.hint}</span>
          </div>
        ))}
      </div>
    </Card>
  </section>
)
