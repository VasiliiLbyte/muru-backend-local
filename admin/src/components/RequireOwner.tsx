import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

export const RequireOwner = () => {
  const { admin, loading } = useAuth()

  if (loading) {
    return (
      <main className="loading-screen">
        <div className="muru-spinner" aria-hidden />
        <p className="loading-screen__text">Загрузка...</p>
      </main>
    )
  }

  if (!admin) {
    return <Navigate to="/login" replace />
  }

  if (admin.role !== 'owner') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
