import { AdminPage } from './AdminPage'

type AdminDashboardProps = {
  userId?: number
  onBack: () => void
}

export const AdminDashboard = ({ userId, onBack }: AdminDashboardProps) => {
  return <AdminPage userId={userId} onBack={onBack} />
}
