import type { LegalDocSlug } from '../types/content'

export type LegalDocSectionMeta = {
  title: string
  hint: string
  defaultTitle: string
}

export const LEGAL_DOC_SECTION_META: Record<LegalDocSlug, LegalDocSectionMeta> = {
  privacy: {
    title: 'Политика конфиденциальности',
    hint: 'Страница /legal/privacy/ на витрине',
    defaultTitle: 'Политика конфиденциальности',
  },
  offer: {
    title: 'Публичная оферта',
    hint: 'Страница /legal/offer/ на витрине',
    defaultTitle: 'Публичная оферта',
  },
  delivery: {
    title: 'Доставка',
    hint: 'Страница /help/delivery/ на витрине',
    defaultTitle: 'Доставка',
  },
  refund: {
    title: 'Возврат',
    hint: 'Страница /help/refund/ на витрине',
    defaultTitle: 'Возврат',
  },
  terms: {
    title: 'Условия обслуживания',
    hint: 'Страница /help/terms/ на витрине',
    defaultTitle: 'Условия обслуживания',
  },
  consent: {
    title: 'Согласие на обработку персональных данных',
    hint: 'Страница /legal/consent/ на витрине',
    defaultTitle: 'Согласие на обработку персональных данных',
  },
}
