import { useEffect, useMemo, useState } from 'react'

import { fetchMyOrders, fetchMyProfile, saveMyProfile } from '../lib/api'
import type { OrderHistoryItem, ProfileData } from '../types/cart'

type ProfilePageProps = {
  userId?: number
  isAdmin: boolean
  webAppClose?: () => void
  onOpenFavorites: () => void
  onOpenOrders: () => void
  onOpenAdmin: () => void
}

const initialProfile = (telegramUserId: number): ProfileData => ({
  telegramUserId,
  fullName: '',
  phone: '',
  deliveryAddresses: [],
})

export const ProfilePage = ({
  userId,
  isAdmin,
  webAppClose,
  onOpenFavorites,
  onOpenOrders,
  onOpenAdmin,
}: ProfilePageProps) => {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [orders, setOrders] = useState<OrderHistoryItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const hasAuth = useMemo(() => Boolean(userId), [userId])

  useEffect(() => {
    if (!userId) return

    Promise.all([fetchMyProfile(userId), fetchMyOrders(userId)])
      .then(([profileData, ordersData]) => {
        setProfile(profileData)
        setOrders(ordersData)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить данные профиля'))
      .finally(() => setIsLoading(false))
  }, [userId])

  if (!hasAuth) {
    return (
      <section className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
        <h1 className="text-xl font-semibold text-muru-olive">Профиль</h1>
        <p className="mt-2 text-sm">Требуется авторизация в Telegram.</p>
      </section>
    )
  }

  const profileData = profile ?? initialProfile(userId!)

  const handleSaveProfile = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const saved = await saveMyProfile(profileData)
      setProfile(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить профиль')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    sessionStorage.clear()
    localStorage.removeItem('muru-profile-cache')
    if (webAppClose) {
      webAppClose()
      return
    }
    window.location.reload()
  }

  const baseName = profileData.fullName.trim()
  const initials = baseName
    ? baseName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
    : 'M'

  return (
    <section className="space-y-3 rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
      <h1 className="text-xl font-semibold text-muru-olive">Мой профиль</h1>

      <div className="rounded-2xl bg-[#efe8d8] p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff9d80] to-[#ff4d74] text-2xl font-semibold text-white">
            {initials}
          </div>
          <div className="text-sm">
            <p className="font-semibold">{profileData.fullName || 'Пользователь Telegram'}</p>
            <p>Баланс: 0 ₽</p>
            <p>Бонусы: 0 ❤️</p>
            <p>Персональная скидка: 10%</p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 rounded-2xl bg-[#efe8d8] p-3 text-sm">
        <button type="button" className="rounded-xl bg-white px-3 py-2 text-left" onClick={onOpenFavorites}>
          Избранное
        </button>
        <button type="button" className="rounded-xl bg-white px-3 py-2 text-left" onClick={onOpenOrders}>
          Мои заказы
        </button>
        <button type="button" className="rounded-xl bg-white px-3 py-2 text-left">
          Отзывы
        </button>
        <button type="button" className="rounded-xl bg-white px-3 py-2 text-left">
          Политика конфиденциальности
        </button>
        <button type="button" className="rounded-xl bg-white px-3 py-2 text-left">
          Пользовательское соглашение
        </button>
      </div>

      <div className="grid gap-2 rounded-2xl bg-[#efe8d8] p-3">
        <label className="text-sm">
          ФИО
          <input
            className="mt-1 w-full rounded-lg border border-muru-accent bg-white px-3 py-2 text-sm"
            value={profileData.fullName}
            onChange={(event) =>
              setProfile((prev) => ({ ...(prev ?? initialProfile(userId!)), fullName: event.target.value }))
            }
            placeholder="Введите ФИО"
          />
        </label>
        <label className="text-sm">
          Телефон
          <input
            className="mt-1 w-full rounded-lg border border-muru-accent bg-white px-3 py-2 text-sm"
            value={profileData.phone}
            onChange={(event) =>
              setProfile((prev) => ({ ...(prev ?? initialProfile(userId!)), phone: event.target.value }))
            }
            placeholder="+7 (...) ...-..-.."
          />
        </label>
        <label className="text-sm">
          Адрес доставки
          <input
            className="mt-1 w-full rounded-lg border border-muru-accent bg-white px-3 py-2 text-sm"
            value={profileData.deliveryAddresses[0] ?? ''}
            onChange={(event) =>
              setProfile((prev) => ({
                ...(prev ?? initialProfile(userId!)),
                deliveryAddresses: event.target.value ? [event.target.value] : [],
              }))
            }
            placeholder="Введите адрес доставки"
          />
        </label>
        <button
          type="button"
          className="rounded-xl bg-muru-olive px-4 py-2 text-sm font-medium text-muru-ivory"
          disabled={isLoading}
          onClick={handleSaveProfile}
        >
          Сохранить профиль
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl bg-[#efe8d8] p-3">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#d9d0bd]">
              <th className="px-2 py-1">№</th>
              <th className="px-2 py-1">Дата</th>
              <th className="px-2 py-1">Статус</th>
              <th className="px-2 py-1">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {orders.slice(0, 3).map((order) => (
              <tr key={order.id} className="border-b border-[#e5dcc9] last:border-b-0">
                <td className="px-2 py-1">{order.id}</td>
                <td className="px-2 py-1">{new Date(order.createdAt).toLocaleDateString('ru-RU')}</td>
                <td className="px-2 py-1">{order.status}</td>
                <td className="px-2 py-1">{order.total.toFixed(2)} ₽</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 ? <p className="mt-2 text-sm">История заказов пока пуста.</p> : null}
      </div>

      <div className="grid gap-2">
        <button
          type="button"
          className="rounded-xl bg-[#e3dccd] px-4 py-2 text-sm font-medium"
          onClick={handleLogout}
        >
          Выйти
        </button>
        {isAdmin ? (
          <button
            type="button"
            className="rounded-xl bg-muru-olive px-4 py-2 text-sm font-medium text-muru-ivory"
            onClick={onOpenAdmin}
          >
            Админ
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </section>
  )
}
