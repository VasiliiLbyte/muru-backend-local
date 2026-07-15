import { Field, Input, Textarea } from '../ui'

type SeoFieldsProps = {
  seoTitle: string
  seoDescription: string
  onSeoTitleChange: (value: string) => void
  onSeoDescriptionChange: (value: string) => void
}

export const SeoFields = ({
  seoTitle,
  seoDescription,
  onSeoTitleChange,
  onSeoDescriptionChange,
}: SeoFieldsProps) => (
  <>
    <Field label="SEO title" htmlFor="seoTitle">
      <Input id="seoTitle" value={seoTitle} onChange={(e) => onSeoTitleChange(e.target.value)} />
    </Field>
    <Field label="SEO description" htmlFor="seoDescription">
      <Textarea
        id="seoDescription"
        rows={3}
        value={seoDescription}
        onChange={(e) => onSeoDescriptionChange(e.target.value)}
      />
    </Field>
  </>
)
