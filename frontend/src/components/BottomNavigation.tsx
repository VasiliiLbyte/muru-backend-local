import { useMemo, type FC } from 'react'

type BottomNavigationProps = {
  activeTab: string
  onSelectTab: (tab: string) => void
  cartItemCount?: number
}

const tabs = ['Каталог', 'Поиск', 'Корзина', 'Избранное', 'Профиль'] as const

const IconCatalog: FC<{ active: boolean }> = ({ active }) => (
  <svg
    className={`h-5 w-5 shrink-0 ${active ? 'text-muru-olive' : 'text-muru-text'}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    aria-hidden
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
)

const IconSearch: FC<{ active: boolean }> = ({ active }) => (
  <svg
    className={`h-5 w-5 shrink-0 ${active ? 'text-muru-olive' : 'text-muru-text'}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    aria-hidden
  >
    <circle cx="11" cy="11" r="6" />
    <path d="M16 16l5 5" strokeLinecap="round" />
  </svg>
)

const IconCart: FC<{ active: boolean }> = ({ active }) => (
  <svg
    className={`h-5 w-5 shrink-0 ${active ? 'text-muru-olive' : 'text-muru-text'}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    aria-hidden
  >
    <path d="M6 6h15l-1.5 9H7.5L6 6zm0 0L5 3H2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="9" cy="20" r="1" fill="currentColor" stroke="none" />
    <circle cx="18" cy="20" r="1" fill="currentColor" stroke="none" />
  </svg>
)

const IconHeart: FC<{ active: boolean }> = ({ active }) => (
  <svg
    className={`h-5 w-5 shrink-0 ${active ? 'text-muru-olive' : 'text-muru-text'}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    aria-hidden
  >
    <path
      d="M12 21s-7-4.35-7-10a5 5 0 0 1 9.5-2 5 5 0 0 1 9.5 2c0 5.65-7 10-7 10z"
      strokeLinejoin="round"
    />
  </svg>
)

const IconProfile: FC<{ active: boolean }> = ({ active }) => (
  <svg
    className={`h-5 w-5 shrink-0 ${active ? 'text-muru-olive' : 'text-muru-text'}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    aria-hidden
  >
    <circle cx="12" cy="8" r="3.5" />
    <path d="M6 20c0-3.5 2.5-6 6-6s6 2.5 6 6" strokeLinecap="round" />
  </svg>
)

const tabIcons: Record<(typeof tabs)[number], FC<{ active: boolean }>> = {
  Каталог: IconCatalog,
  Поиск: IconSearch,
  Корзина: IconCart,
  Избранное: IconHeart,
  Профиль: IconProfile,
}

export const BottomNavigation = ({ activeTab, onSelectTab, cartItemCount = 0 }: BottomNavigationProps) => {
  const activeIndex = useMemo(() => {
    const i = tabs.indexOf(activeTab as (typeof tabs)[number])
    return i >= 0 ? i : 0
  }, [activeTab])

  return (
    <div
      className="pointer-events-none fixed bottom-0 left-1/2 z-30 w-[min(560px,calc(100%-1rem))] -translate-x-1/2 px-0 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2"
    >
      <nav
        className="pointer-events-auto mx-auto rounded-[2rem] border border-muru-accent/40 bg-muru-ivory/95 p-1.5 shadow-[0_-4px_24px_rgba(94,82,82,0.12)] backdrop-blur-sm"
        aria-label="Основная навигация"
      >
        <div className="relative">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-[#f5efe3] shadow-sm transition-[left] duration-300 ease-out"
            style={{
              width: '20%',
              left: `${activeIndex * 20}%`,
            }}
          />
          <div className="relative z-10 grid grid-cols-5">
            {tabs.map((tab) => {
              const active = activeTab === tab
              const Icon = tabIcons[tab]
              return (
                <button
                  key={tab}
                  type="button"
                  className="flex min-w-0 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-full py-2 transition-transform duration-150 active:scale-95"
                  onClick={() => onSelectTab(tab)}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="relative flex h-5 w-5 items-center justify-center">
                    <Icon active={active} />
                    {tab === 'Корзина' && cartItemCount > 0 ? (
                      <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-muru-text px-0.5 text-[10px] font-semibold leading-none text-muru-ivory">
                        {cartItemCount > 99 ? '99+' : cartItemCount}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`max-w-full truncate px-0.5 text-[10px] font-medium leading-tight sm:text-[11px] ${
                      active ? 'text-muru-olive' : 'text-muru-text'
                    }`}
                  >
                    {tab}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}
