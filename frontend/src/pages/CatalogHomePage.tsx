import { Link } from 'react-router-dom'

import type { CatalogNode } from '../types/catalog'

type CatalogHomePageProps = {
  tree: CatalogNode[]
}

const ORDERED_CATEGORIES = [
  'Флористика',
  'Натуральный декор',
  'Вазы и аксессуары',
  'Текстиль',
  'Кухня и столовая',
  'Интерьер',
  'Распродажа',
  'Комплексные наборы',
]

export const CatalogHomePage = ({ tree }: CatalogHomePageProps) => {
  const map = new Map(tree.map((item) => [item.name, item]))

  return (
    <section className="space-y-4">
      <div className="rounded-3xl bg-muru-olive p-5 text-muru-ivory">
        <p className="text-xs uppercase tracking-widest opacity-90">MURU Home Design</p>
        <h1 className="mt-2 text-2xl font-semibold">Каталог MURU</h1>
        <p className="mt-1 text-sm">Выберите категорию и перейдите к подборке товаров.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ORDERED_CATEGORIES.map((name) => {
          const category = map.get(name)
          const link = category ? `/catalog/${category.slug}` : '/catalog'
          return (
            <Link
              key={name}
              to={link}
              className={`block rounded-2xl border border-muru-accent bg-[#fff9ed] p-3 ${
                category ? 'hover:bg-[#f5efdf]' : 'opacity-60'
              }`}
            >
              <div className="mb-3 aspect-[4/3] rounded-xl bg-[#efe8d8]"></div>
              <h2 className="text-sm font-semibold text-muru-olive">{name}</h2>
              <p className="mt-1 text-xs">
                {category ? `${category.children.length} подкатегорий` : 'Скоро появится'}
              </p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
