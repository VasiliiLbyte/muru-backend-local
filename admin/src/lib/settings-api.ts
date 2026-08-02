import type {
  CatalogPlaceholderSettingsInput,
  CdekSettingsInput,
  ContactSettingsInput,
  IntegrationsStatus,
  RequisitesSettingsInput,
  SiteSettingsDto,
  YookassaSettingsInput,
} from '../types/settings'
import { apiFetch } from './api'

const CRM_BASE = '/api/crm/settings'

export const getSiteSettings = () => apiFetch<SiteSettingsDto>(`${CRM_BASE}/site`)

export const updateContactSettings = (body: ContactSettingsInput) =>
  apiFetch<SiteSettingsDto>(`${CRM_BASE}/site/contacts`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

export const updateRequisitesSettings = (body: RequisitesSettingsInput) =>
  apiFetch<SiteSettingsDto>(`${CRM_BASE}/site/requisites`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

export const updateCatalogPlaceholderSettings = (body: CatalogPlaceholderSettingsInput) =>
  apiFetch<SiteSettingsDto>(`${CRM_BASE}/site/catalog-placeholder`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

export const updateCdekSettings = (body: CdekSettingsInput) =>
  apiFetch<SiteSettingsDto>(`${CRM_BASE}/cdek`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

export const updateYookassaSettings = (body: YookassaSettingsInput) =>
  apiFetch<SiteSettingsDto>(`${CRM_BASE}/yookassa`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

export const getIntegrationsStatus = () =>
  apiFetch<IntegrationsStatus>(`${CRM_BASE}/integrations-status`)
