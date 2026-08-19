import { readFileSync, writeFileSync } from 'fs'

import { google } from 'googleapis'

import { env } from '../src/utils/env.ts'
import { extractDriveFileId } from '../src/utils/drive-file-id.ts'

type Row = { sku: string; name: string; main_photo: string; add_photos: string; kind: string }

function loadRealMissing(): Row[] {
  const text = readFileSync(
    '/Users/vasilii/Desktop/code /muru-docs/audits/catalog-parity-2026-07-28/missing_in_crm.csv',
    'utf8',
  )
  const lines = text.trim().split(/\r?\n/)
  const hdr = lines[0].split(',')
  const idx = Object.fromEntries(hdr.map((h, i) => [h, i]))
  const rows: Row[] = []
  for (const line of lines.slice(1)) {
    // naive CSV: enough for our simple file without embedded commas in critical fields except names
    // Use regex split keeping quotes — fallback to JSON from sheet via simpler parse
    const cols: string[] = []
    let cur = ''
    let q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        q = !q
        continue
      }
      if (ch === ',' && !q) {
        cols.push(cur)
        cur = ''
        continue
      }
      cur += ch
    }
    cols.push(cur)
    if ((cols[idx.kind] || '') !== 'REAL') continue
    rows.push({
      sku: cols[idx.sku],
      name: cols[idx.name],
      main_photo: cols[idx.main_photo] || '',
      add_photos: cols[idx.add_photos] || '',
      kind: cols[idx.kind],
    })
  }
  return rows
}

async function main() {
  const auth = new google.auth.JWT({
    email: env.googleServiceAccountEmail,
    key: env.googlePrivateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  const drive = google.drive({ version: 'v3', auth })
  const rows = loadRealMissing()

  const foundByName: Record<string, Array<{ id: string; name: string }>> = {}
  for (let n = 296; n <= 333; n++) {
    const sku = `MU${String(n).padStart(4, '0')}`
    const q = `name contains '${sku}' and trashed = false and (mimeType contains 'image/')`
    const res = await drive.files.list({
      q,
      fields: 'files(id,name)',
      pageSize: 20,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    foundByName[sku] = (res.data.files || []).map((f) => ({ id: f.id!, name: f.name! }))
  }

  const linkCheck: Array<{
    sku: string
    name: string
    urls: number
    files: Array<Record<string, unknown>>
  }> = []

  for (const r of rows) {
    const urls = [r.main_photo, ...(r.add_photos || '').split(';')]
      .map((s) => s.trim())
      .filter(Boolean)
    const ids = [...new Set(urls.map((u) => extractDriveFileId(u)).filter(Boolean))] as string[]
    const files: Array<Record<string, unknown>> = []
    for (const id of ids) {
      try {
        const meta = await drive.files.get({
          fileId: id,
          fields: 'id,name,mimeType,size,trashed',
          supportsAllDrives: true,
        })
        files.push({
          id,
          ok: true,
          name: meta.data.name,
          mime: meta.data.mimeType,
          size: meta.data.size,
        })
      } catch (e) {
        files.push({ id, ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    }
    linkCheck.push({ sku: r.sku, name: r.name, urls: ids.length, files })
  }

  const namedHits = Object.entries(foundByName).filter(([, v]) => v.length > 0)
  const linksOk = linkCheck.filter((x) => x.files.some((f) => f.ok))
  const linksFail = linkCheck.filter((x) => x.files.length > 0 && x.files.every((f) => !f.ok))
  const noLinks = linkCheck.filter((x) => x.urls === 0)

  const nameCounts: Record<string, number> = {}
  for (const x of linkCheck) {
    for (const f of x.files) {
      if (f.ok && typeof f.name === 'string') {
        nameCounts[f.name] = (nameCounts[f.name] || 0) + 1
      }
    }
  }

  const out = {
    namedFilenameHits: Object.fromEntries(namedHits),
    namedHitSkuCount: namedHits.length,
    linkCheck,
    summary: {
      real: rows.length,
      skusWithNamedFiles: namedHits.length,
      skusWithWorkingSheetLinks: linksOk.length,
      skusWithBrokenSheetLinks: linksFail.length,
      skusWithoutSheetLinks: noLinks.length,
      reusedFilenames: Object.entries(nameCounts)
        .filter(([, c]) => c > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25),
    },
  }

  writeFileSync(
    '/Users/vasilii/Desktop/code /muru-docs/audits/catalog-parity-2026-07-28/drive_new_sku_check.json',
    JSON.stringify(out, null, 2),
  )
  console.log(JSON.stringify(out.summary, null, 2))
  console.log('named hits', namedHits.length, namedHits.slice(0, 3))
  console.log(
    'working sample',
    linksOk.slice(0, 4).map((x) => ({
      sku: x.sku,
      files: x.files.map((f) => ({ name: f.name, ok: f.ok })),
    })),
  )
  console.log(
    'fail sample',
    linksFail.slice(0, 3).map((x) => ({ sku: x.sku, files: x.files })),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
