type PlaceholderSectionProps = {
  title: string
  description?: string
}

export const PlaceholderSection = ({ title, description }: PlaceholderSectionProps) => (
  <div className="space-y-3">
    <h2 className="text-lg font-semibold text-muru-olive">{title}</h2>
    <div className="rounded-xl bg-[#efe8d8] px-4 py-8 text-center text-sm text-[#5c5346]">
      <p className="font-medium text-muru-olive">Раздел в разработке</p>
      {description ? <p className="mt-2">{description}</p> : null}
    </div>
  </div>
)
