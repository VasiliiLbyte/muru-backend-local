type PlaceholderPageProps = {
  title: string
}

export const PlaceholderPage = ({ title }: PlaceholderPageProps) => {
  return (
    <section className="rounded-2xl border border-muru-accent bg-[#fff9ed] p-4">
      <h1 className="text-xl font-semibold text-muru-olive">{title}</h1>
      <p className="mt-2 text-sm">Раздел находится в разработке.</p>
    </section>
  )
}
