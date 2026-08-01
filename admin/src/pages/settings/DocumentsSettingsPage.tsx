import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'

import { LEGAL_DOC_SECTION_META } from '../../constants/legal-docs'
import { Card, PageHeader } from '../../components/ui'
import { LEGAL_DOC_SLUGS } from '../../types/content'

export const DocumentsSettingsPage = () => (
  <section className="page-stack">
    <PageHeader title="Юридические документы" />

    <Card title="Документы">
      <p className="muted-text">Текст и видимость на витрине. Редактирование — rich-text + SEO.</p>
      <div className="section-links-grid">
        {LEGAL_DOC_SLUGS.map((slug) => {
          const meta = LEGAL_DOC_SECTION_META[slug]
          return (
            <Link key={slug} className="section-link-card" to={`/settings/documents/${slug}`}>
              <span className="section-link-card__title">
                <FileText size={16} aria-hidden /> {meta.title}
              </span>
              <span className="section-link-card__hint">{meta.hint}</span>
            </Link>
          )
        })}
      </div>
    </Card>
  </section>
)
