import { Badge } from '../ui/Badge'

export const CatalogReadOnlyBanner = () => (
  <div className="catalog-readonly-notice" role="status">
    <Badge variant="warning">Только чтение</Badge>
    <span>Каталог синхронизируется из Google Sheets. Редактирование в CRM недоступно.</span>
  </div>
)
