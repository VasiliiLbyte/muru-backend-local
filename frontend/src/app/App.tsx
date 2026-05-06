import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'

import { AdminDashboard } from '../admin/AdminDashboard'
import { CartProvider, useCart } from '../cart/CartContext'
import { CatalogFilters } from '../components/CatalogFilters'
import { CatalogSearch } from '../components/CatalogSearch'
import { BottomNavigation } from '../components/BottomNavigation'
import { FavoritesProvider, useFavorites } from '../favorites/FavoritesContext'
import { useTelegramWebApp } from '../hooks/useTelegramWebApp'
import { fetchCatalogProductBySku, fetchCatalogProducts, fetchCatalogTree, notifyRestock } from '../lib/api'
import type { CatalogNode, CatalogProduct, CatalogProductDetail } from '../types/catalog'
import { CatalogCategoryPage } from '../pages/CatalogCategoryPage'
import { CatalogHomePage } from '../pages/CatalogHomePage'
import { CatalogProductsPage } from '../pages/CatalogProductsPage'
import { CartPage } from '../pages/CartPage'
import { CheckoutPage } from '../pages/CheckoutPage'
import { FavoritesPage } from '../pages/FavoritesPage'
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
  onNotifyRestock: (product: CatalogProduct) => void
  onProductsLoading: (value: boolean) => void
  isProductsLoading: boolean
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
  onNotifyRestock,
  onProductsLoading,
  isProductsLoading,
}: CatalogRoutesProps) => {
  const params = useParams<{ categorySlug?: string; subcategorySlug?: string }>()
  const category = tree.find((item) => item.slug === params.categorySlug)
  const subcategory = category?.children.find((item) => item.slug === params.subcategorySlug)

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onProductsLoading(true)
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
        .finally(() => onProductsLoading(false))
    }, 250)

    return () => clearTimeout(timeoutId)
  }, [category, subcategory, search, filters, onProductsChange, onProductsLoading])

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
                onNotifyRestock={onNotifyRestock}
                isLoading={isProductsLoading}
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
  const [isCatalogLoading, setIsCatalogLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<CatalogProductDetail | null>(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ color: '', size: '', priceMax: '' })
  const { userId, isAdmin, webApp } = useTelegramWebApp()
  const { addProduct, loadDraft } = useCart()
  const { favorites, favoriteSkus, isLoading: favoritesLoading, loadFavorites, toggleFavorite } = useFavorites()

  useEffect(() => {
    fetchCatalogTree().then(setCatalogTree).catch(() => setCatalogTree([]))
  }, [])

  useEffect(() => {
    if (activeTab === 'Корзина') {
      loadDraft(userId).catch(() => undefined)
    }
  }, [activeTab, loadDraft, userId])

  useEffect(() => {
    const app = webApp
    if (!app) return
    const isInnerScreen = Boolean(selectedProduct || isCheckoutOpen || isAdminPageOpen)
    const handleBack = () => {
      if (selectedProduct) {
        setSelectedProduct(null)
        return
      }
      if (isCheckoutOpen) {
        setIsCheckoutOpen(false)
        return
      }
      if (isAdminPageOpen) {
        setIsAdminPageOpen(false)
      }
    }

    if (isInnerScreen) {
      app.BackButton.show()
      app.BackButton.onClick?.(handleBack)
    } else {
      app.BackButton.hide()
    }

    return () => {
      app.BackButton.offClick?.(handleBack)
      if (!isInnerScreen) app.BackButton.hide()
    }
  }, [webApp, selectedProduct, isCheckoutOpen, isAdminPageOpen])

  const handleNotifyRestock = (product: CatalogProduct | CatalogProductDetail) => {
    if (!userId) {
      alert('Требуется авторизация в Telegram для уведомления о поступлении.')
      return
    }
    notifyRestock({ telegramUserId: userId, sku: product.sku, productName: product.name })
      .then(() => alert('Запрос принят. Мы уведомим вас о поступлении товара.'))
      .catch((error) => alert(error instanceof Error ? error.message : 'Не удалось отправить уведомление'))
  }

  useEffect(() => {
    if (userId) {
      loadFavorites(userId).catch(() => undefined)
    }
  }, [userId, loadFavorites])

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
        return (
          <ProductDetailPage
            product={selectedProduct}
            onAddToCart={addProduct}
            onNotifyRestock={handleNotifyRestock}
            isAuthorized={Boolean(userId)}
            isFavorite={favoriteSkus.has(selectedProduct.sku)}
            onToggleFavorite={(product) => {
              toggleFavorite(userId, {
                sku: product.sku,
                name: product.name,
                price: product.price,
                imageUrl: product.imageUrls[0],
                inStock: product.inStock,
              }).catch(() => undefined)
            }}
          />
        )
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
                onNotifyRestock={handleNotifyRestock}
                onProductsLoading={setIsCatalogLoading}
                isProductsLoading={isCatalogLoading}
              />
            }
          />
          <Route path="*" element={<Navigate to="/catalog" />} />
        </Routes>
      )
    }
    if (activeTab === 'Профиль') {
      return (
        <ProfilePage
          userId={userId}
          isAdmin={isAdmin}
          webAppClose={webApp?.close}
          onGoCatalog={() => handleSelectTab('Каталог')}
          onOpenFavorites={() => handleSelectTab('Избранное')}
          onOpenOrders={() => handleSelectTab('Корзина')}
          onOpenAdmin={() => setIsAdminPageOpen(true)}
        />
      )
    }
    if (activeTab === 'Избранное') {
      return <FavoritesPage items={favorites} isLoading={favoritesLoading} onGoCatalog={() => handleSelectTab('Каталог')} />
    }
    if (activeTab === 'Корзина') {
      if (isCheckoutOpen) {
        return <CheckoutPage userId={userId} onBackToCart={() => setIsCheckoutOpen(false)} />
      }
      return (
        <CartPage
          userId={userId}
          onGoCatalog={() => handleSelectTab('Каталог')}
          onCheckout={() => setIsCheckoutOpen(true)}
        />
      )
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
        <FavoritesProvider>
          <AppShell />
        </FavoritesProvider>
      </CartProvider>
    </BrowserRouter>
  )
}

export default App
