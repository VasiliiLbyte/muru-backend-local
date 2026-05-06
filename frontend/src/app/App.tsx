import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'

import { AdminDashboard } from '../admin/AdminDashboard'
import { CartProvider, useCart } from '../cart/CartContext'
import { CatalogFilters } from '../components/CatalogFilters'
import { CatalogSearch } from '../components/CatalogSearch'
import { BottomNavigation } from '../components/BottomNavigation'
import { useTelegramWebApp } from '../hooks/useTelegramWebApp'
import { fetchCatalogProductBySku, fetchCatalogProducts, fetchCatalogTree } from '../lib/api'
import type { CatalogNode, CatalogProduct, CatalogProductDetail } from '../types/catalog'
import { CatalogCategoryPage } from '../pages/CatalogCategoryPage'
import { CatalogHomePage } from '../pages/CatalogHomePage'
import { CatalogProductsPage } from '../pages/CatalogProductsPage'
import { CartPage } from '../pages/CartPage'
import { CheckoutPage } from '../pages/CheckoutPage'
import { PlaceholderPage } from '../pages/PlaceholderPage'
import { ProductDetailPage } from '../pages/ProductDetailPage'
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
  onOpenProductDetail: (sku: string) => void
  onAddToCart: (product: CatalogProduct) => void
}

const CatalogRoutes = ({
  tree,
  products,
  search,
  filters,
  onSearchChange,
  onFilterChange,
  onProductsChange,
  onOpenProductDetail,
  onAddToCart,
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
              <CatalogProductsPage
                title={`${category.name} / ${subcategory.name}`}
                products={products}
                onOpenProductDetail={onOpenProductDetail}
                onAddToCart={onAddToCart}
              />
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
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [isAdminPageOpen, setIsAdminPageOpen] = useState(false)
  const [catalogTree, setCatalogTree] = useState<CatalogNode[]>([])
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([])
  const [selectedProduct, setSelectedProduct] = useState<CatalogProductDetail | null>(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ color: '', size: '', priceMax: '' })
  const { userId, isAdmin } = useTelegramWebApp()
  const { addProduct, loadDraft } = useCart()

  useEffect(() => {
    fetchCatalogTree().then(setCatalogTree).catch(() => setCatalogTree([]))
  }, [])

  useEffect(() => {
    if (activeTab === 'Корзина') {
      loadDraft(userId).catch(() => undefined)
    }
  }, [activeTab, loadDraft, userId])

  const handleSelectTab = (tab: string) => {
    setActiveTab(tab)
    setIsCheckoutOpen(false)
    setIsAdminPageOpen(false)
    setSelectedProduct(null)
    if (tab === 'Каталог') navigate('/catalog')
  }

  const renderPage = () => {
    if (isAdminPageOpen && isAdmin) {
      return <AdminDashboard userId={userId} onBack={() => setIsAdminPageOpen(false)} />
    }
    if (activeTab === 'Каталог') {
      if (selectedProduct) {
        return <ProductDetailPage product={selectedProduct} onAddToCart={addProduct} />
      }

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
                onOpenProductDetail={(sku) => {
                  fetchCatalogProductBySku(sku)
                    .then(setSelectedProduct)
                    .catch(() => setSelectedProduct(null))
                }}
                onAddToCart={addProduct}
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
    if (activeTab === 'Корзина') {
      if (isCheckoutOpen) {
        return <CheckoutPage userId={userId} onBackToCart={() => setIsCheckoutOpen(false)} />
      }
      return <CartPage userId={userId} onCheckout={() => setIsCheckoutOpen(true)} />
    }
    return <PlaceholderPage title={activeTab} />
  }

  const pageContent = renderPage()

  return (
    <div className="mx-auto flex min-h-screen max-w-[560px] flex-col bg-muru-ivory">
      <main className="flex-1 px-4 pb-24 pt-4">{pageContent}</main>
      <BottomNavigation activeTab={activeTab} onSelectTab={handleSelectTab} />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <AppShell />
      </CartProvider>
    </BrowserRouter>
  )
}

export default App
