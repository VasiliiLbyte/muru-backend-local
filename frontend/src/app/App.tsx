import { useMemo, useState } from 'react'

import { BottomNavigation } from '../components/BottomNavigation'
import { useTelegramWebApp } from '../hooks/useTelegramWebApp'
import { CatalogPage } from '../pages/CatalogPage'
import { PlaceholderPage } from '../pages/PlaceholderPage'
import { ProfilePage } from '../pages/ProfilePage'

const DEFAULT_TAB = 'Каталог'

const renderPage = (activeTab: string, userId: number | undefined, isAdmin: boolean) => {
  if (activeTab === 'Каталог') return <CatalogPage />
  if (activeTab === 'Профиль') return <ProfilePage userId={userId} isAdmin={isAdmin} />
  return <PlaceholderPage title={activeTab} />
}

function App() {
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB)
  const { userId, isAdmin } = useTelegramWebApp()

  const pageContent = useMemo(
    () => renderPage(activeTab, userId, isAdmin),
    [activeTab, userId, isAdmin],
  )

  return (
    <div className="app-shell">
      <main className="app-content">{pageContent}</main>
      <BottomNavigation activeTab={activeTab} onSelectTab={setActiveTab} />
    </div>
  )
}

export default App
