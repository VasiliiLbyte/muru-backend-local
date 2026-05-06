import { useEffect, useMemo, useState } from 'react'

import { fetchMyOrders, fetchMyProfile, saveMyProfile } from '../lib/api'
import type { OrderHistoryItem, ProfileData } from '../types/cart'

type ProfilePageProps = {
  userId?: number
  isAdmin: boolean
  webAppClose?: () => void
  onOpenAdmin: () => void
}

const initialProfile = (telegramUserId: number): ProfileData => ({
  telegramUserId,
  fullName: '',
  phone: '',
  deliveryAddresses: [],
})

export const ProfilePage = ({ userId, isAdmin, webAppClose, onOpenAdmin }: ProfilePageProps) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'orders'>('profile')
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [orders, setOrders] = useState<OrderHistoryItem[]>([])
  const [newAddress, setNewAddress] = useState('')
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

  const addAddress = () => {
    const value = newAddress.trim()
    if (!value) return
    setProfile((prev) => {
      const base = prev ?? initialProfile(userId!)
      if (base.deliveryAddresses.includes(value)) return base
      return {
        ...base,
        deliveryAddresses: [...base.deliveryAddresses, value],
      }
    })
    setNewAddress('')
  }

  const removeAddress = (index: number) => {
    setProfile((prev) => {
      const base = prev ?? initialProfile(userId!)
      return {
        ...base,
        deliveryAddresses: base.deliveryAddresses.filter((_, idx) => idx !== index),
      }
    })
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

  return (
    <section className="space-y-3 rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
      <h1 className="text-xl font-semibold text-muru-olive">Личный кабинет</h1>
      <p className="text-sm">Telegram ID: {userId}</p>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={`rounded-xl px-3 py-2 text-sm ${activeTab === 'profile' ? 'bg-muru-olive text-muru-ivory' : 'bg-[#efe8d8]'}`}
          onClick={() => setActiveTab('profile')}
        >
          Профиль
        </button>
        <button
          type="button"
          className={`rounded-xl px-3 py-2 text-sm ${activeTab === 'orders' ? 'bg-muru-olive text-muru-ivory' : 'bg-[#efe8d8]'}`}
          onClick={() => setActiveTab('orders')}
        >
          Мои заказы
        </button>
      </div>

      {activeTab === 'profile' ? (
        <div className="grid gap-3 rounded-xl bg-[#efe8d8] p-3">
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

          <div className="text-sm">
            <p className="font-medium">Сохраненные адреса</p>
            <div className="mt-2 flex gap-2">
              <input
                className="flex-1 rounded-lg border border-muru-accent bg-white px-3 py-2 text-sm"
                value={newAddress}
                onChange={(event) => setNewAddress(event.target.value)}
                placeholder="Добавить адрес доставки"
              />
              <button type="button" className="rounded-lg bg-muru-olive px-3 py-2 text-xs text-muru-ivory" onClick={addAddress}>
                Добавить
              </button>
            </div>
            <ul className="mt-2 grid gap-1">
              {profileData.deliveryAddresses.map((address, index) => (
                <li key={`${address}-${index}`} className="flex items-center gap-2 rounded-lg bg-white px-2 py-2">
                  <span className="flex-1 text-xs">{address}</span>
                  <button type="button" className="rounded bg-[#efe8d8] px-2 py-1 text-xs" onClick={() => removeAddress(index)}>
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-[#efe8d8] p-3">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#d9d0bd]">
                <th className="px-2 py-1">№</th>
                <th className="px-2 py-1">Дата</th>
                <th className="px-2 py-1">Статус</th>
                <th className="px-2 py-1">Сумма</th>
                <th className="px-2 py-1">Товары</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-[#e5dcc9] last:border-b-0">
                  <td className="px-2 py-1">{order.id}</td>
                  <td className="px-2 py-1">{new Date(order.createdAt).toLocaleDateString('ru-RU')}</td>
                  <td className="px-2 py-1">{order.status}</td>
                  <td className="px-2 py-1">{order.total.toFixed(2)} ₽</td>
                  <td className="px-2 py-1">{order.items.map((item) => `${item.name} x${item.quantity}`).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 ? <p className="mt-2 text-sm">История заказов пока пуста.</p> : null}
        </div>
      )}

      <div className="grid gap-2">
        <button
          type="button"
          className="rounded-xl bg-muru-olive px-4 py-2 text-sm font-medium text-muru-ivory"
          disabled={isLoading}
          onClick={handleSaveProfile}
        >
          Сохранить профиль
        </button>
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
