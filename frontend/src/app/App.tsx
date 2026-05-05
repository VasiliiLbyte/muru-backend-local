import { useMemo, useState } from 'react'

import { AdminPage } from '../admin/AdminPage'
import { BottomNavigation } from '../components/BottomNavigation'
import { useTelegramWebApp } from '../hooks/useTelegramWebApp'
import { CatalogPage } from '../pages/CatalogPage'
import { PlaceholderPage } from '../pages/PlaceholderPage'
import { ProfilePage } from '../pages/ProfilePage'

const DEFAULT_TAB = 'Каталог'

const renderPage = (
  activeTab: string,
  userId: number | undefined,
  isAdmin: boolean,
  isAdminPageOpen: boolean,
  onOpenAdmin: () => void,
  onCloseAdmin: () => void,
) => {
  if (isAdminPageOpen && isAdmin) {
    return <AdminPage userId={userId} onBack={onCloseAdmin} />
  }

  if (activeTab === 'Каталог') return <CatalogPage />
  if (activeTab === 'Профиль') {
    return <ProfilePage userId={userId} isAdmin={isAdmin} onOpenAdmin={onOpenAdmin} />
  }

  return <PlaceholderPage title={activeTab} />
}

function App() {
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB)
  const [isAdminPageOpen, setIsAdminPageOpen] = useState(false)
  const { userId, isAdmin } = useTelegramWebApp()

  const handleSelectTab = (tab: string) => {
    setActiveTab(tab)
    setIsAdminPageOpen(false)
  }

  const pageContent = useMemo(
    () =>
      renderPage(
        activeTab,
        userId,
        isAdmin,
        isAdminPageOpen,
        () => setIsAdminPageOpen(true),
        () => setIsAdminPageOpen(false),
      ),
    [activeTab, userId, isAdmin, isAdminPageOpen],
  )

  return (
    <div className="app-shell">
      <main className="app-content">{pageContent}</main>
      <BottomNavigation activeTab={activeTab} onSelectTab={handleSelectTab} />
    </div>
  )
}

export default App
