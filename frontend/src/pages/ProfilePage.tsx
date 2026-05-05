type ProfilePageProps = {
  userId?: number
  isAdmin: boolean
  onOpenAdmin: () => void
}

export const ProfilePage = ({ userId, isAdmin, onOpenAdmin }: ProfilePageProps) => {
  return (
    <section className="page-card">
      <h1>Профиль</h1>
      <p>{userId ? `Ваш Telegram ID: ${userId}` : 'Telegram ID недоступен'}</p>

      <ul className="profile-menu">
        <li>Мои заказы</li>
        <li>Адреса доставки</li>
        <li>Избранное</li>
        {isAdmin ? (
          <li className="admin-item admin-link" onClick={onOpenAdmin}>
            Админ
          </li>
        ) : null}
      </ul>
    </section>
  )
}
