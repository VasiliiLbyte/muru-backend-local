import { useEffect, useState, type ReactNode } from 'react'

import { fetchApiHealth, type ApiHealthStatus } from '../lib/api'
import { pressable } from '../lib/uiClasses'

import { ADMIN_NAV_ITEMS, type AdminSectionId } from './admin-sections'

type AdminLayoutProps = {
  userId?: number
  activeSection: AdminSectionId
  onSectionChange: (section: AdminSectionId) => void
  onBack: () => void
  children: ReactNode
}

const healthLabel = (status: ApiHealthStatus | 'checking'): string => {
  if (status === 'checking') return 'проверка…'
  if (status === 'ok') return 'онлайн'
  return 'недоступен'
}

const navButtonClass = (active: boolean) =>
  [
    pressable,
    'shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
    active ? 'bg-muru-olive text-muru-ivory' : 'bg-[#efe8d8] text-muru-olive hover:bg-[#e3dccd]',
  ].join(' ')

export const AdminLayout = ({
  userId,
  activeSection,
  onSectionChange,
  onBack,
  children,
}: AdminLayoutProps) => {
  const [health, setHealth] = useState<ApiHealthStatus | 'checking'>('checking')

  useEffect(() => {
    let cancelled = false
    void fetchApiHealth().then((result) => {
      if (!cancelled) setHealth(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4 text-muru-olive">
      <div className="border-b border-[#d8cfbc] pb-3 text-xs text-[#5c5346] sm:text-sm">
        <span className="font-medium text-muru-olive">Админ</span>
        <span className="mx-1.5 text-[#9a9085]">•</span>
        <span>Telegram ID: {userId ?? '—'}</span>
        <span className="mx-1.5 text-[#9a9085]">•</span>
        <span>Сервер: {healthLabel(health)}</span>
      </div>

      <h1 className="mt-3 text-xl font-semibold">Админ-панель</h1>

      <nav
        className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:hidden"
        aria-label="Разделы админки"
      >
        {ADMIN_NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={navButtonClass(activeSection === item.id)}
            onClick={() => onSectionChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <nav className="hidden w-44 shrink-0 flex-col gap-1 sm:flex" aria-label="Разделы админки">
          {ADMIN_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={navButtonClass(activeSection === item.id)}
              onClick={() => onSectionChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <button
        type="button"
        className={`${pressable} mt-4 w-full rounded-xl bg-[#efe8d8] px-4 py-2 text-sm font-medium sm:w-auto`}
        onClick={onBack}
      >
        Назад в профиль
      </button>
    </section>
  )
}
