import { Link } from 'react-router-dom'
import { Building2, CreditCard, FileText, Phone, Truck, Users } from 'lucide-react'

import { Badge, Card, PageHeader } from '../../components/ui'

const soonItems = [
  { label: 'SEO-шаблоны', hint: 'Мета-теги товаров и категорий' },
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

        <Link className="section-link-card" to="/settings/contacts">
          <span className="section-link-card__title">
            <Phone size={16} aria-hidden /> Контакты
          </span>
          <span className="section-link-card__hint">Телефон, email, адрес, соцсети</span>
        </Link>

        <Link className="section-link-card" to="/settings/requisites">
          <span className="section-link-card__title">
            <Building2 size={16} aria-hidden /> Реквизиты
          </span>
          <span className="section-link-card__hint">Юрлицо, ИНН, банк</span>
        </Link>

        <Link className="section-link-card" to="/settings/documents">
          <span className="section-link-card__title">
            <FileText size={16} aria-hidden /> Юридические документы
          </span>
          <span className="section-link-card__hint">Оферта, политика, согласие 152-ФЗ</span>
        </Link>

        <Link className="section-link-card" to="/settings/cdek">
          <span className="section-link-card__title">
            <Truck size={16} aria-hidden /> Доставка (СДЭК)
          </span>
          <span className="section-link-card__hint">Адрес отправителя, тарифы, габариты</span>
        </Link>

        <Link className="section-link-card" to="/settings/yookassa">
          <span className="section-link-card__title">
            <CreditCard size={16} aria-hidden /> Оплата (ЮКасса / 54-ФЗ)
          </span>
          <span className="section-link-card__hint">Чек, НДС, параметры магазина</span>
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
