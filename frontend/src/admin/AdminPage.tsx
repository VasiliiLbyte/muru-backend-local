import { useState } from 'react'

import { AdminBotWelcomeSection } from './AdminBotWelcomeSection'
import { AdminPromoCodesSection } from './AdminPromoCodesSection'
import { AdminCategoriesSection } from './AdminCategoriesSection'
import { AdminOrdersSection } from './AdminOrdersSection'
import { AdminLayout } from './AdminLayout'
import { AdminSyncSection } from './AdminSyncSection'
import { PlaceholderSection } from './PlaceholderSection'
import type { AdminSectionId } from './admin-sections'
import { getAdminNavLabel } from './admin-sections'

type AdminPageProps = {
  userId?: number
  onBack: () => void
}

const needsUserId = (section: AdminSectionId): boolean =>
  section === 'sync' ||
  section === 'categories' ||
  section === 'orders' ||
  section === 'promos' ||
  section === 'settings'

export const AdminPage = ({ userId, onBack }: AdminPageProps) => {
  const [section, setSection] = useState<AdminSectionId>('sync')

  const renderSection = () => {
    if (needsUserId(section) && !userId) {
      return (
        <div className="rounded-xl bg-[#efe8d8] p-4 text-sm text-red-700">
          Не удалось определить Telegram user ID.
        </div>
      )
    }

    switch (section) {
      case 'sync':
        return (
          <AdminSyncSection
            userId={userId!}
            onOpenCategories={() => setSection('categories')}
          />
        )
      case 'categories':
        return <AdminCategoriesSection userId={userId!} />
      case 'orders':
        return <AdminOrdersSection userId={userId!} />
      case 'products':
        return <PlaceholderSection title="Товары" />
      case 'customers':
        return <PlaceholderSection title="Клиенты" />
      case 'promos':
        return <AdminPromoCodesSection userId={userId!} />
      case 'settings':
        return <AdminBotWelcomeSection userId={userId!} />
      default:
        return <PlaceholderSection title={getAdminNavLabel(section)} />
    }
  }

  return (
    <AdminLayout
      userId={userId}
      activeSection={section}
      onSectionChange={setSection}
      onBack={onBack}
    >
      {renderSection()}
    </AdminLayout>
  )
}
