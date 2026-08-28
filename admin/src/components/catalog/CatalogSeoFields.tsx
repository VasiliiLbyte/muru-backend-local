import { RichTextEditor } from '../content/RichTextEditor'
import { Field, Input, Textarea } from '../ui'

const SEO_TITLE_LIMIT = 60
const SEO_DESCRIPTION_LIMIT = 160

type CatalogSeoFieldsBaseProps = {
  entityName: string
  seoTitle: string
  seoDescription: string
  seoH1: string
  onSeoTitleChange: (value: string) => void
  onSeoDescriptionChange: (value: string) => void
  onSeoH1Change: (value: string) => void
  disabled?: boolean
  idPrefix?: string
}

type CatalogSeoFieldsProductProps = CatalogSeoFieldsBaseProps & {
  variant: 'product'
}

type CatalogSeoFieldsListingProps = CatalogSeoFieldsBaseProps & {
  variant: 'listing'
  seoIntroTop: string
  seoTextBottom: string
  onSeoIntroTopChange: (value: string) => void
  onSeoTextBottomChange: (value: string) => void
}

export type CatalogSeoFieldsProps = CatalogSeoFieldsProductProps | CatalogSeoFieldsListingProps

const SeoCharCount = ({ value, limit }: { value: string; limit: number }) => {
  const length = value.length
  const overLimit = length > limit
  return (
    <span className={`seo-char-count${overLimit ? ' seo-char-count--warn' : ''}`}>
      {length}/{limit}
    </span>
  )
}

export const CatalogSeoFields = (props: CatalogSeoFieldsProps) => {
  const {
    entityName,
    seoTitle,
    seoDescription,
    seoH1,
    onSeoTitleChange,
    onSeoDescriptionChange,
    onSeoH1Change,
    disabled = false,
    idPrefix = 'catalog-seo',
  } = props

  const fallbackHint = `если пусто — ${entityName}`

  return (
    <div className="form-stack">
      <Field label="SEO title" htmlFor={`${idPrefix}-title`}>
        <Input
          id={`${idPrefix}-title`}
          value={seoTitle}
          onChange={(e) => onSeoTitleChange(e.target.value)}
          placeholder={fallbackHint}
          disabled={disabled}
        />
        <SeoCharCount value={seoTitle} limit={SEO_TITLE_LIMIT} />
      </Field>

      <Field label="SEO description" htmlFor={`${idPrefix}-description`}>
        <Textarea
          id={`${idPrefix}-description`}
          rows={3}
          value={seoDescription}
          onChange={(e) => onSeoDescriptionChange(e.target.value)}
          placeholder={fallbackHint}
          disabled={disabled}
        />
        <SeoCharCount value={seoDescription} limit={SEO_DESCRIPTION_LIMIT} />
      </Field>

      <Field label="SEO H1" htmlFor={`${idPrefix}-h1`}>
        <Input
          id={`${idPrefix}-h1`}
          value={seoH1}
          onChange={(e) => onSeoH1Change(e.target.value)}
          placeholder={fallbackHint}
          disabled={disabled}
        />
      </Field>

      {props.variant === 'listing' ? (
        <>
          <Field label="SEO intro (верх)" htmlFor={`${idPrefix}-intro-top`}>
            <Textarea
              id={`${idPrefix}-intro-top`}
              rows={3}
              value={props.seoIntroTop}
              onChange={(e) => props.onSeoIntroTopChange(e.target.value)}
              disabled={disabled}
            />
          </Field>

          {disabled ? (
            <Field label="SEO текст (низ)" htmlFor={`${idPrefix}-text-bottom`}>
              <Textarea
                id={`${idPrefix}-text-bottom`}
                rows={6}
                value={props.seoTextBottom}
                readOnly
              />
            </Field>
          ) : (
            <RichTextEditor
              label="SEO текст (низ)"
              value={props.seoTextBottom}
              onChange={props.onSeoTextBottomChange}
            />
          )}
        </>
      ) : null}
    </div>
  )
}
