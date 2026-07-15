import { Navigate, Outlet } from 'react-router-dom'

import { Tabs, TabsList, TabsTrigger } from '../ui'

const tabs = [
  { to: '/content/pages', label: 'Страницы' },
  { to: '/content/banners', label: 'Баннеры' },
] as const

export const ContentLayout = () => (
  <div className="content-module">
    <header className="content-header">
      <h2 className="content-title">Контент</h2>
      <Tabs>
        <TabsList aria-label="Разделы контента">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.to} to={tab.to}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </header>
    <Outlet />
  </div>
)

export const ContentIndexRedirect = () => <Navigate to="pages" replace />
