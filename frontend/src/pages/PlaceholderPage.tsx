type PlaceholderPageProps = {
  title: string
}

export const PlaceholderPage = ({ title }: PlaceholderPageProps) => {
  return (
    <section className="page-card">
      <h1>{title}</h1>
      <p>Раздел находится в разработке.</p>
    </section>
  )
}
