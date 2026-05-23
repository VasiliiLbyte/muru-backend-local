export const ORDER_STATUS_OPTIONS = [
  'Черновик',
  'Новый',
  'В обработке',
  'Подтверждён',
  'Собирается',
  'Передан в доставку',
  'Доставлен',
  'Отменён',
  'Возврат',
] as const

const STATUS_BADGE_CLASS: Record<string, string> = {
  Новый: 'bg-[#fde2c9] text-[#7a3d12]',
  'В обработке': 'bg-[#fff2c4] text-[#6e560f]',
  Подтверждён: 'bg-[#d4e5b6] text-[#3e5a1c]',
  Собирается: 'bg-[#cce4dc] text-[#214a3e]',
  'Передан в доставку': 'bg-[#cfd9eb] text-[#26375e]',
  Доставлен: 'bg-[#bbd6a8] text-[#2c4515]',
  Отменён: 'bg-[#f3c5c5] text-[#7a2222]',
  Возврат: 'bg-[#ead2c6] text-[#6b3220]',
  Черновик: 'bg-[#efe8d8] text-[#5c5346]',
}

export const orderStatusBadgeClass = (status: string): string =>
  STATUS_BADGE_CLASS[status] ?? 'bg-[#efe8d8] text-muru-olive'

export const formatOrderDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export const formatMoney = (value: number): string =>
  `${value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽`

export const phoneDigits = (phone: string | null | undefined): string =>
  (phone ?? '').replace(/\D/g, '')

export const buildClientTelegramUrl = (
  telegramUserId: number,
  phone: string | null | undefined,
): string => {
  const digits = phoneDigits(phone)
  if (digits.length >= 10) {
    return `https://t.me/+${digits}`
  }
  return `tg://user?id=${telegramUserId}`
}
