type ProfilePageProps = {
  userId?: number
  isAdmin: boolean
  onOpenAdmin: () => void
}

export const ProfilePage = ({ userId, isAdmin, onOpenAdmin }: ProfilePageProps) => {
  return (
    <section className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
      <h1 className="text-xl font-semibold text-muru-olive">Профиль</h1>
      <p className="mt-2 text-sm">{userId ? `Ваш Telegram ID: ${userId}` : 'Telegram ID недоступен'}</p>

      <ul className="mt-4 grid gap-2">
        <li className="rounded-xl bg-[#efe8d8] px-3 py-2 text-sm">Мои заказы</li>
        <li className="rounded-xl bg-[#efe8d8] px-3 py-2 text-sm">Адреса доставки</li>
        <li className="rounded-xl bg-[#efe8d8] px-3 py-2 text-sm">Избранное</li>
        {isAdmin ? (
          <li
            className="cursor-pointer rounded-xl bg-muru-olive px-3 py-2 text-sm text-muru-ivory"
            onClick={onOpenAdmin}
          >
            Админ
          </li>
        ) : null}
      </ul>
    </section>
  )
}
