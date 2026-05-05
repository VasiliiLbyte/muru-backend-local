import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'

import { AdminPage } from '../admin/AdminPage'
import { CatalogFilters } from '../components/CatalogFilters'
import { CatalogSearch } from '../components/CatalogSearch'
import { BottomNavigation } from '../components/BottomNavigation'
import { useTelegramWebApp } from '../hooks/useTelegramWebApp'
import { fetchCatalogProducts, fetchCatalogTree } from '../lib/api'
import type { CatalogNode, CatalogProduct } from '../types/catalog'
import { CatalogCategoryPage } from '../pages/CatalogCategoryPage'
import { CatalogHomePage } from '../pages/CatalogHomePage'
import { CatalogProductsPage } from '../pages/CatalogProductsPage'
import { PlaceholderPage } from '../pages/PlaceholderPage'
import { ProfilePage } from '../pages/ProfilePage'

const DEFAULT_TAB = 'Каталог'

type CatalogRoutesProps = {
  tree: CatalogNode[]
  products: CatalogProduct[]
  search: string
  filters: { color: string; size: string; priceMax: string }
  onSearchChange: (value: string) => void
  onFilterChange: (key: 'color' | 'size' | 'priceMax', value: string) => void
  onProductsChange: (items: CatalogProduct[]) => void
}

const CatalogRoutes = ({
  tree,
  products,
  search,
  filters,
  onSearchChange,
  onFilterChange,
  onProductsChange,
}: CatalogRoutesProps) => {
  const params = useParams<{ categorySlug?: string; subcategorySlug?: string }>()
  const category = tree.find((item) => item.slug === params.categorySlug)
  const subcategory = category?.children.find((item) => item.slug === params.subcategorySlug)

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchCatalogProducts({
        category: category?.name,
        subcategory: subcategory?.name,
        q: search || undefined,
        color: filters.color || undefined,
        size: filters.size || undefined,
        priceMax: filters.priceMax ? Number(filters.priceMax) : undefined,
      })
        .then(onProductsChange)
        .catch(() => onProductsChange([]))
    }, 250)

    return () => clearTimeout(timeoutId)
  }, [category, subcategory, search, filters, onProductsChange])

  return (
    <>
      <CatalogSearch value={search} onChange={onSearchChange} />
      <CatalogFilters
        color={filters.color}
        size={filters.size}
        priceMax={filters.priceMax}
        onColorChange={(value) => onFilterChange('color', value)}
        onSizeChange={(value) => onFilterChange('size', value)}
        onPriceMaxChange={(value) => onFilterChange('priceMax', value)}
      />
      <Routes>
        <Route path="/" element={<CatalogHomePage tree={tree} />} />
        <Route
          path="/:categorySlug"
          element={category ? <CatalogCategoryPage category={category} /> : <Navigate to="/catalog" />}
        />
        <Route
          path="/:categorySlug/:subcategorySlug"
          element={
            category && subcategory ? (
              <CatalogProductsPage title={`${category.name} / ${subcategory.name}`} products={products} />
            ) : (
              <Navigate to="/catalog" />
            )
          }
        />
      </Routes>
    </>
  )
}

const AppShell = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB)
  const [isAdminPageOpen, setIsAdminPageOpen] = useState(false)
  const [catalogTree, setCatalogTree] = useState<CatalogNode[]>([])
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([])
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ color: '', size: '', priceMax: '' })
  const { userId, isAdmin } = useTelegramWebApp()

  useEffect(() => {
    fetchCatalogTree().then(setCatalogTree).catch(() => setCatalogTree([]))
  }, [])

  const handleSelectTab = (tab: string) => {
    setActiveTab(tab)
    setIsAdminPageOpen(false)
    if (tab === 'Каталог') navigate('/catalog')
  }

  const renderPage = () => {
    if (isAdminPageOpen && isAdmin) {
      return <AdminPage userId={userId} onBack={() => setIsAdminPageOpen(false)} />
    }
    if (activeTab === 'Каталог') {
      return (
        <Routes>
          <Route
            path="/catalog/*"
            element={
              <CatalogRoutes
                tree={catalogTree}
                products={catalogProducts}
                search={search}
                filters={filters}
                onSearchChange={setSearch}
                onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
                onProductsChange={setCatalogProducts}
              />
            }
          />
          <Route path="*" element={<Navigate to="/catalog" />} />
        </Routes>
      )
    }
    if (activeTab === 'Профиль') {
      return <ProfilePage userId={userId} isAdmin={isAdmin} onOpenAdmin={() => setIsAdminPageOpen(true)} />
    }
    return <PlaceholderPage title={activeTab} />
  }

  const pageContent = useMemo(renderPage, [
    activeTab,
    isAdminPageOpen,
    isAdmin,
    userId,
    catalogTree,
    catalogProducts,
    search,
    filters,
  ])

  return (
    <div className="app-shell">
      <main className="app-content">{pageContent}</main>
      <BottomNavigation activeTab={activeTab} onSelectTab={handleSelectTab} />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

export default App
