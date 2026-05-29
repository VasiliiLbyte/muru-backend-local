import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'

import { AdminDashboard } from '../admin/AdminDashboard'
import { CartProvider, useCart } from '../cart/CartContext'
import { CatalogSearch } from '../components/CatalogSearch'
import { BottomNavigation } from '../components/BottomNavigation'
import { FavoritesProvider, useFavorites } from '../favorites/FavoritesContext'
import { useTelegramWebApp } from '../hooks/useTelegramWebApp'
import { fetchCatalogProductBySku, fetchCatalogProducts, fetchCatalogTree, notifyRestock } from '../lib/api'
import { hapticSelection } from '../lib/haptics'
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
import { SearchPage } from '../pages/SearchPage'

const DEFAULT_TAB = 'Каталог'

type BottomTab = typeof DEFAULT_TAB | 'Поиск' | 'Корзина' | 'Избранное' | 'Профиль'

const tabFromQueryParam = (raw: string | null): BottomTab | null => {
  const tab = raw?.trim().toLowerCase()
  if (tab === 'cart') return 'Корзина'
  if (tab === 'favorites') return 'Избранное'
  if (tab === 'catalog' || tab === '') return 'Каталог'
  if (tab === 'search') return 'Поиск'
  if (tab === 'profile') return 'Профиль'
  return null
}

type CatalogRoutesProps = {
  tree: CatalogNode[]
  products: CatalogProduct[]
  search: string
  onSearchChange: (value: string) => void
  onProductsChange: (items: CatalogProduct[]) => void
  onOpenProductDetail: (sku: string) => void
  onAddToCart: (product: CatalogProduct) => void
  onNotifyRestock: (product: CatalogProduct) => void
  onProductsLoading: (value: boolean) => void
  isProductsLoading: boolean
  onSearchActivate?: () => void
}

const CatalogRoutes = ({
  tree,
  products,
  search,
  onSearchChange,
  onProductsChange,
  onOpenProductDetail,
  onAddToCart,
  onNotifyRestock,
  onProductsLoading,
  isProductsLoading,
  onSearchActivate,
}: CatalogRoutesProps) => {
  const requestSeqRef = useRef(0)
  const location = useLocation()
  const params = useParams<{ categorySlug?: string; subcategorySlug?: string }>()
  const [productsRouteKey, setProductsRouteKey] = useState<string | null>(null)

  const normalizedCatalogPath = (location.pathname.replace(/\/$/, '') || '/')
  const isCatalogRoot = normalizedCatalogPath === '/catalog'

  const safeDecode = (value: string) => {
    if (!value) return ''
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  const pathMatch = location.pathname.replace(/\/$/, '').match(/\/catalog\/([^/]+)(?:\/([^/]+))?$/)
  const categorySlugFromPath = pathMatch?.[1] ? safeDecode(pathMatch[1]) : ''
  const subcategorySlugFromPath = pathMatch?.[2] ? safeDecode(pathMatch[2]) : ''

  const categorySlugRaw = params.categorySlug ?? categorySlugFromPath
  const categorySlugDecoded = safeDecode(categorySlugRaw)
  const subcategorySlugRaw = params.subcategorySlug ?? subcategorySlugFromPath
  const subcategorySlugDecoded = safeDecode(subcategorySlugRaw)
  const fallbackCategoryName = categorySlugDecoded.replace(/-/g, ' ')
  const fallbackSubcategoryName = subcategorySlugDecoded.replace(/-/g, ' ')

  const category = tree.find((item) => item.slug === categorySlugRaw || item.slug === categorySlugDecoded)
  const subcategory = category?.children.find(
    (item) => item.slug === subcategorySlugRaw || item.slug === subcategorySlugDecoded,
  )
  const categoryNameForQuery = category?.name ?? (categorySlugRaw ? fallbackCategoryName : undefined)
  const subcategoryNameForQuery = subcategory?.name ?? (subcategorySlugRaw ? fallbackSubcategoryName : undefined)

  const trimmedSearch = search.trim()
  const showsSubcategoriesGrid = Boolean(category?.children.length && !subcategorySlugRaw)
  const shouldFetchProducts = !isCatalogRoot && !showsSubcategoriesGrid
  const currentRouteKey = `${categorySlugRaw}|${subcategorySlugRaw}|${trimmedSearch}`

  useEffect(() => {
    if (!shouldFetchProducts) {
      onProductsChange([])
      onProductsLoading(false)
      setProductsRouteKey(currentRouteKey)
      return
    }

    const requestId = ++requestSeqRef.current
    setProductsRouteKey(null)
    onProductsChange([])
    onProductsLoading(true)

    const debounceMs = trimmedSearch ? 250 : 0
    const timeoutId = window.setTimeout(() => {
      fetchCatalogProducts({
        category: categoryNameForQuery,
        categorySlug: category?.slug ?? (categorySlugRaw || undefined),
        subcategory: subcategoryNameForQuery,
        subcategorySlug: subcategory?.slug ?? (subcategorySlugRaw || undefined),
        q: trimmedSearch || undefined,
      })
        .then((items) => {
          if (requestSeqRef.current !== requestId) return
          onProductsChange(items)
          setProductsRouteKey(currentRouteKey)
        })
        .catch(() => {
          if (requestSeqRef.current !== requestId) return
          onProductsChange([])
          setProductsRouteKey(currentRouteKey)
        })
        .finally(() => {
          if (requestSeqRef.current !== requestId) return
          onProductsLoading(false)
        })
    }, debounceMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    tree,
    shouldFetchProducts,
    currentRouteKey,
    categorySlugRaw,
    subcategorySlugRaw,
    category?.slug,
    subcategory?.slug,
    categoryNameForQuery,
    subcategoryNameForQuery,
    trimmedSearch,
    onProductsChange,
    onProductsLoading,
  ])

  const productsMatchRoute = productsRouteKey === currentRouteKey
  const productsForRender = productsMatchRoute ? products : []
  const isProductsLoadingForRender = isProductsLoading || !productsMatchRoute

  return (
    <>
      <CatalogSearch value={search} onChange={onSearchChange} onActivate={onSearchActivate} />
      <Routes>
        <Route index element={<CatalogHomePage tree={tree} />} />
        <Route
          path=":categorySlug"
          element={
            category?.children.length ? (
                <CatalogCategoryPage category={category} />
            ) : (
              <CatalogProductsPage
                title={category?.name ?? fallbackCategoryName}
                products={productsForRender}
                onOpenProductDetail={onOpenProductDetail}
                onAddToCart={onAddToCart}
                onNotifyRestock={onNotifyRestock}
                isLoading={isProductsLoadingForRender}
              />
            )
          }
        />
        <Route
          path=":categorySlug/:subcategorySlug"
          element={
            <CatalogProductsPage
              title={`${category?.name ?? fallbackCategoryName} / ${subcategory?.name ?? fallbackSubcategoryName}`}
              products={productsForRender}
              onOpenProductDetail={onOpenProductDetail}
              onAddToCart={onAddToCart}
              onNotifyRestock={onNotifyRestock}
              isLoading={isProductsLoadingForRender}
            />
          }
        />
      </Routes>
    </>
  )
}

const AppShell = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [isAdminPageOpen, setIsAdminPageOpen] = useState(false)
  const [catalogTree, setCatalogTree] = useState<CatalogNode[]>([])
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([])
  const [isCatalogLoading, setIsCatalogLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<CatalogProductDetail | null>(null)
  const [search, setSearch] = useState('')
  const { userId, isAdmin, webApp } = useTelegramWebApp()
  const { addProduct, items: cartItems } = useCart()
  const cartItemCount = useMemo(() => cartItems.reduce((n, i) => n + i.quantity, 0), [cartItems])
  const { favorites, favoriteSkus, isLoading: favoritesLoading, loadFavorites, toggleFavorite } = useFavorites()

  useEffect(() => {
    fetchCatalogTree().then(setCatalogTree).catch(() => setCatalogTree([]))
  }, [])

  useEffect(() => {
    const path = location.pathname.replace(/\/$/, '') || '/'
    if (path === '/' || path === '') {
      navigate({ pathname: '/catalog', search: location.search, hash: location.hash }, { replace: true })
    }
  }, [location.pathname, location.search, location.hash, navigate])

  useEffect(() => {
    const tab = tabFromQueryParam(new URLSearchParams(window.location.search).get('tab'))
    if (!tab) return
    setActiveTab(tab)
    if (tab === 'Каталог') {
      navigate({ pathname: '/catalog', search: location.search, hash: location.hash }, { replace: true })
    }
  }, [navigate, location.search, location.hash])

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
    hapticSelection()
    setActiveTab(tab)
    setIsCheckoutOpen(false)
    setIsAdminPageOpen(false)
    setSelectedProduct(null)
    if (tab === 'Каталог') {
      navigate('/catalog')
    }
  }

  const goToCatalogFromSearch = () => {
    setSearch('')
    handleSelectTab('Каталог')
  }

  const openProductBySku = (sku: string) => {
    fetchCatalogProductBySku(sku).then(setSelectedProduct).catch(() => setSelectedProduct(null))
  }

  const productDetail = selectedProduct ? (
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
  ) : null

  const screenTransitionKey = useMemo(() => {
    if (selectedProduct) return `product-${selectedProduct.sku}`
    if (isAdminPageOpen && isAdmin) return 'admin'
    if (activeTab === 'Каталог') return `catalog-${location.pathname}`
    if (activeTab === 'Поиск') return 'search'
    if (activeTab === 'Профиль') return 'profile'
    if (activeTab === 'Избранное') return 'favorites'
    if (activeTab === 'Корзина') return isCheckoutOpen ? 'checkout' : 'cart'
    return `tab-${activeTab}`
  }, [
    isAdminPageOpen,
    isAdmin,
    activeTab,
    selectedProduct,
    location.pathname,
    isCheckoutOpen,
  ])

  const renderPage = () => {
    if (selectedProduct) {
      return productDetail
    }
    if (isAdminPageOpen && isAdmin) {
      return <AdminDashboard userId={userId} onBack={() => setIsAdminPageOpen(false)} />
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
                onSearchChange={setSearch}
                onSearchActivate={() => setActiveTab('Поиск')}
                onProductsChange={setCatalogProducts}
                onOpenProductDetail={openProductBySku}
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
    if (activeTab === 'Поиск') {
      return (
        <SearchPage
          query={search}
          onQueryChange={setSearch}
          onOpenProductDetail={openProductBySku}
          onAddToCart={addProduct}
          onNotifyRestock={handleNotifyRestock}
          onGoToCatalog={goToCatalogFromSearch}
        />
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
      return (
        <FavoritesPage
          items={favorites}
          userId={userId}
          isLoading={favoritesLoading}
          onGoCatalog={() => handleSelectTab('Каталог')}
          onOpenProductDetail={openProductBySku}
          onRemoveFavorite={
            userId !== undefined
              ? (item) => toggleFavorite(userId, item).catch(() => undefined)
              : undefined
          }
        />
      )
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
      <main className="flex-1 px-4 pb-28 pt-4">
        <div key={screenTransitionKey} className="muru-page-transition">
          {pageContent}
        </div>
      </main>
      <BottomNavigation activeTab={activeTab} onSelectTab={handleSelectTab} cartItemCount={cartItemCount} />
    </div>
  )
}

const AppWithCart = () => {
  const { userId } = useTelegramWebApp()
  return (
    <CartProvider telegramUserId={userId}>
      <FavoritesProvider>
        <AppShell />
      </FavoritesProvider>
    </CartProvider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppWithCart />
    </BrowserRouter>
  )
}

export default App
