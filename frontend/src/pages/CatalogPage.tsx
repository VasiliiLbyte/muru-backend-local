const categories = [
  'Мебель',
  'Освещение',
  'Декор',
  'Текстиль',
  'Кухня',
  'Хранение',
]

export const CatalogPage = () => {
  return (
    <section>
      <div className="hero-banner">
        <p className="hero-banner__badge">MURU Home Design</p>
        <h1>Интерьер с характером</h1>
        <p>Подберите предметы для уютного и функционального дома.</p>
      </div>

      <div className="category-grid">
        {categories.map((category) => (
          <article key={category} className="category-card">
            <h2>{category}</h2>
            <p>Товары в фирменной стилистике MURU.</p>
          </article>
        ))}
      </div>
    </section>
  )
}
