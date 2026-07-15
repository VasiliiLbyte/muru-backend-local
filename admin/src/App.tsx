import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { ContentIndexRedirect, ContentLayout } from './components/content/ContentLayout'
import { CatalogIndexRedirect, CatalogLayout } from './components/catalog/CatalogLayout'
import { ProtectedLayout } from './components/ProtectedLayout'
import { ConfirmProvider, ToastProvider } from './components/ui'
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
import { OrderDetailPage } from './pages/orders/OrderDetailPage'
import { OrdersListPage } from './pages/orders/OrdersListPage'
import { CharacteristicsPage } from './pages/catalog/CharacteristicsPage'
import { ImportExportPage } from './pages/catalog/ImportExportPage'
import { ProductEditPage } from './pages/catalog/ProductEditPage'
import { ProductsListPage } from './pages/catalog/ProductsListPage'
import { CategoryDetailPage } from './pages/sections/CategoryDetailPage'
import { GiftGuideListPage } from './pages/sections/GiftGuideListPage'
import { SectionsHubPage } from './pages/sections/SectionsHubPage'

const ContentLookbooksRedirect = () => {
  const location = useLocation()
  const path = location.pathname.replace(/^\/content\/lookbooks/, '/catalog/sections/inspiration')
  return <Navigate to={`${path}${location.search}${location.hash}`} replace />
}

const ContentCollectionsRedirect = () => {
  const location = useLocation()
  const path = location.pathname.replace(/^\/content\/collections/, '/catalog/sections/collections')
  return <Navigate to={`${path}${location.search}${location.hash}`} replace />
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="orders" element={<OrdersListPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="catalog" element={<CatalogLayout />}>
            <Route index element={<CatalogIndexRedirect />} />
            <Route path="sections" element={<SectionsHubPage />} />
            <Route path="sections/categories/:id" element={<CategoryDetailPage />} />
            <Route path="sections/inspiration" element={<LookbooksListPage />} />
            <Route path="sections/inspiration/new" element={<LookbookEditPage />} />
            <Route path="sections/inspiration/:id" element={<LookbookEditPage />} />
            <Route path="sections/collections" element={<CollectionsListPage />} />
            <Route path="sections/collections/new" element={<CollectionEditPage />} />
            <Route path="sections/collections/:id" element={<CollectionEditPage />} />
            <Route path="sections/gift-guide" element={<GiftGuideListPage />} />
            <Route path="products" element={<ProductsListPage />} />
            <Route path="products/new" element={<ProductEditPage />} />
            <Route path="products/:id" element={<ProductEditPage />} />
            <Route path="categories" element={<Navigate to="/catalog/sections" replace />} />
            <Route path="characteristics" element={<CharacteristicsPage />} />
            <Route path="import-export" element={<ImportExportPage />} />
          </Route>
          <Route path="content" element={<ContentLayout />}>
            <Route index element={<ContentIndexRedirect />} />
            <Route path="pages" element={<PagesListPage />} />
            <Route path="pages/new" element={<PageEditPage />} />
            <Route path="pages/:id" element={<PageEditPage />} />
            <Route path="lookbooks/*" element={<ContentLookbooksRedirect />} />
            <Route path="collections/*" element={<ContentCollectionsRedirect />} />
            <Route path="banners" element={<BannersListPage />} />
            <Route path="banners/new" element={<BannerEditPage />} />
            <Route path="banners/:id" element={<BannerEditPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
