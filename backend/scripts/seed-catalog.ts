// Одноразовый засев локального Postgres каталогом из Google (мимо auth/admin).
// Запуск из backend/:  npx tsx scripts/seed-catalog.ts
import { syncCatalogFromGoogle } from '../src/services/google-sync'
import { pool } from '../src/utils/db'

async function main() {
  console.log('[seed] старт синка каталога из Google…')
  const result = await syncCatalogFromGoogle((p) => {
    if (p && p.message) console.log('[seed]', p.phase, '—', p.message)
  })
  console.log('[seed] ГОТОВО:', JSON.stringify(result, null, 2))
  await pool.end()
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed] ОШИБКА:', err)
  process.exit(1)
})
