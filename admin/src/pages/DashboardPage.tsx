import { useAuth } from '../context/AuthContext'

export const DashboardPage = () => {
  const { admin } = useAuth()

  return (
    <section>
      <h2>Дашборд</h2>
      <p className="muted-text">
        {admin ? `${admin.email} (${admin.role})` : ''}
      </p>
      <p>Раздел в разработке.</p>
    </section>
  )
}
