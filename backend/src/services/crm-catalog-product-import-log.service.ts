import { pool } from '../utils/db'

export type ProductImportMode = 'new' | 'upsert'

export type ProductImportRowError = {
  row: number
  sku: string
  field: string
  message: string
}

export type CatalogProductImportLogSummary = {
  toCreate: number
  toUpdate: number
  errorRows: number
  total: number
}

export type CatalogProductImportLogListItem = {
  id: number
  createdAt: string
  filename: string
  mode: ProductImportMode
  adminId: number | null
  adminEmail: string | null
  summary: CatalogProductImportLogSummary
  durationMs: number | null
}

export type CatalogProductImportLogDetail = CatalogProductImportLogListItem & {
  errors: ProductImportRowError[]
}

type LogRow = {
  id: number
  created_at: Date | string
  admin_id: number | null
  admin_email: string | null
  filename: string
  mode: ProductImportMode
  to_create: number
  to_update: number
  error_rows: number
  total: number
  errors: ProductImportRowError[] | null
  duration_ms: number | null
}

const mapListItem = (row: LogRow): CatalogProductImportLogListItem => ({
  id: row.id,
  createdAt:
    row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  filename: row.filename,
  mode: row.mode,
  adminId: row.admin_id,
  adminEmail: row.admin_email,
  summary: {
    toCreate: row.to_create,
    toUpdate: row.to_update,
    errorRows: row.error_rows,
    total: row.total,
  },
  durationMs: row.duration_ms,
})

export type InsertProductImportLogInput = {
  adminId: number | null
  adminEmail: string | null
  filename: string
  mode: ProductImportMode
  summary: CatalogProductImportLogSummary
  errors: ProductImportRowError[]
  durationMs: number | null
}

export const insertCatalogProductImportLog = async (
  input: InsertProductImportLogInput,
): Promise<number> => {
  const result = await pool.query<{ id: number }>(
    `INSERT INTO catalog_product_import_log (
       admin_id, admin_email, filename, mode,
       to_create, to_update, error_rows, total, errors, duration_ms
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
     RETURNING id`,
    [
      input.adminId,
      input.adminEmail,
      input.filename,
      input.mode,
      input.summary.toCreate,
      input.summary.toUpdate,
      input.summary.errorRows,
      input.summary.total,
      JSON.stringify(input.errors),
      input.durationMs,
    ],
  )
  return result.rows[0].id
}

export const listCatalogProductImportLogs = async (
  limit = 50,
): Promise<CatalogProductImportLogListItem[]> => {
  const safeLimit = Math.min(Math.max(limit, 1), 100)
  const result = await pool.query<LogRow>(
    `SELECT id, created_at, admin_id, admin_email, filename, mode,
            to_create, to_update, error_rows, total, duration_ms
     FROM catalog_product_import_log
     ORDER BY created_at DESC
     LIMIT $1`,
    [safeLimit],
  )
  return result.rows.map(mapListItem)
}

export const getCatalogProductImportLogById = async (
  id: number,
): Promise<CatalogProductImportLogDetail | null> => {
  const result = await pool.query<LogRow>(
    `SELECT id, created_at, admin_id, admin_email, filename, mode,
            to_create, to_update, error_rows, total, errors, duration_ms
     FROM catalog_product_import_log
     WHERE id = $1`,
    [id],
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    ...mapListItem(row),
    errors: Array.isArray(row.errors) ? row.errors : [],
  }
}
