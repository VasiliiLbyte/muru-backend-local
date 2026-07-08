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
  <fieldset className="form-section">
    <legend className="form-section-title">SEO</legend>
    <label className="field-label" htmlFor="seoTitle">
      SEO title
    </label>
    <input
      id="seoTitle"
      className="field-input"
      value={seoTitle}
      onChange={(e) => onSeoTitleChange(e.target.value)}
    />
    <label className="field-label" htmlFor="seoDescription">
      SEO description
    </label>
    <textarea
      id="seoDescription"
      className="field-input field-textarea"
      rows={3}
      value={seoDescription}
      onChange={(e) => onSeoDescriptionChange(e.target.value)}
    />
  </fieldset>
)
