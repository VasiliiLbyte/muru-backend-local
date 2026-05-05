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
    <nav className="bottom-nav" aria-label="Основная навигация">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`bottom-nav__item ${activeTab === tab ? 'is-active' : ''}`}
          onClick={() => onSelectTab(tab)}
        >
          {tab}
        </button>
      ))}
    </nav>
  )
}
