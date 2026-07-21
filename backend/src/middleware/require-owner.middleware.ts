import { requireCrmAuth } from './require-crm-auth.middleware'

export const requireOwner = requireCrmAuth(['owner'])
