import { Navigate, Route, Routes } from 'react-router-dom'

import { ContentIndexRedirect, ContentLayout } from './components/content/ContentLayout'
import { ProtectedLayout } from './components/ProtectedLayout'
import { AuthProvider } from './context/AuthContext'
import { BannerEditPage } from './pages/content/BannerEditPage'
import { BannersListPage } from './pages/content/BannersListPage'
import { CollectionEditPage } from './pages/content/CollectionEditPage'
import { CollectionsListPage } from './pages/content/CollectionsListPage'
import { LookbookEditPage } from './pages/content/LookbookEditPage'
import { LookbooksListPage } from './pages/content/LookbooksListPage'
import { PageEditPage } from './pages/content/PageEditPage'
import { PagesListPage } from './pages/content/PagesListPage'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="content" element={<ContentLayout />}>
            <Route index element={<ContentIndexRedirect />} />
            <Route path="pages" element={<PagesListPage />} />
            <Route path="pages/new" element={<PageEditPage />} />
            <Route path="pages/:id" element={<PageEditPage />} />
            <Route path="collections" element={<CollectionsListPage />} />
            <Route path="collections/new" element={<CollectionEditPage />} />
            <Route path="collections/:id" element={<CollectionEditPage />} />
            <Route path="lookbooks" element={<LookbooksListPage />} />
            <Route path="lookbooks/new" element={<LookbookEditPage />} />
            <Route path="lookbooks/:id" element={<LookbookEditPage />} />
            <Route path="banners" element={<BannersListPage />} />
            <Route path="banners/new" element={<BannerEditPage />} />
            <Route path="banners/:id" element={<BannerEditPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
