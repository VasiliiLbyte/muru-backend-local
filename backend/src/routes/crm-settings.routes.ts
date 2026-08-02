import { Router } from 'express'

import {
  getIntegrationsStatusHandler,
  getSiteSettingsHandler,
  updateCatalogPlaceholderSettingsHandler,
  updateCdekSettingsHandler,
  updateContactSettingsHandler,
  updateRequisitesSettingsHandler,
  updateYookassaSettingsHandler,
} from '../controllers/crm-settings.controller'
import { requireCrmAuth } from '../middleware/require-crm-auth.middleware'
import { requireOwner } from '../middleware/require-owner.middleware'

export const crmSettingsRouter = Router()

crmSettingsRouter.use(requireCrmAuth())
crmSettingsRouter.use(requireOwner)

crmSettingsRouter.get('/site', getSiteSettingsHandler)
crmSettingsRouter.put('/site/contacts', updateContactSettingsHandler)
crmSettingsRouter.put('/site/requisites', updateRequisitesSettingsHandler)
crmSettingsRouter.put('/site/catalog-placeholder', updateCatalogPlaceholderSettingsHandler)
crmSettingsRouter.put('/cdek', updateCdekSettingsHandler)
crmSettingsRouter.put('/yookassa', updateYookassaSettingsHandler)
crmSettingsRouter.get('/integrations-status', getIntegrationsStatusHandler)
