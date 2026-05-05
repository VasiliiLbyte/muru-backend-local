type BottomNavigationProps = {
  activeTab: string
  onSelectTab: (tab: string) => void
}

const tabs = ['Каталог', 'Поиск', 'Корзина', 'Избранное', 'Профиль']

export const BottomNavigation = ({
  activeTab,
  onSelectTab,
}: BottomNavigationProps) => {
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-30 grid w-full max-w-[560px] -translate-x-1/2 grid-cols-5 gap-1 border-t border-muru-accent bg-muru-ivory px-2 pb-4 pt-2"
      aria-label="Основная навигация"
    >
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`rounded-lg px-1 py-2 text-[11px] ${
            activeTab === tab ? 'bg-muru-olive text-muru-ivory' : 'bg-[#efe8d8] text-muru-text'
          }`}
          onClick={() => onSelectTab(tab)}
        >
          {tab}
        </button>
      ))}
    </nav>
  )
}
