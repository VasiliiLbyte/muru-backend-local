import { Navigate, useParams } from 'react-router-dom'

import { FixedPageEditPage } from '../content/FixedPageEditPage'
import { LEGAL_DOC_SLUGS, type LegalDocSlug } from '../../types/content'

const isLegalDocSlug = (value: string | undefined): value is LegalDocSlug =>
  typeof value === 'string' && (LEGAL_DOC_SLUGS as readonly string[]).includes(value)

export const LegalDocEditRoute = () => {
  const { slug } = useParams<{ slug: string }>()
  if (!isLegalDocSlug(slug)) {
    return <Navigate to="/settings/documents" replace />
  }
  return <FixedPageEditPage section={slug} />
}
