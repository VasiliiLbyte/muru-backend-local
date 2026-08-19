/**
 * One-off: scan Drive product images and write JSON for catalog parity.
 * Run from backend/: npx tsx ../../muru-docs/scripts/scan-drive-images.ts
 * Or from muru-docs with cwd backend.
 */
import { writeFileSync } from 'fs'
import { resolve } from 'path'

import { scanProductImagesFromDriveTree } from '../src/services/google-drive-product-images.ts'

async function main() {
  const started = Date.now()
  console.log('Scanning Drive tree…')
  const result = await scanProductImagesFromDriveTree((u) => {
    if (u.foldersScanned && u.foldersScanned % 50 === 0) {
      console.log(u.message)
    }
  })

  const bySku: Record<string, { orders: number[]; fileIds: string[]; count: number }> = {}
  for (const [sku, refs] of result.bySku.entries()) {
    bySku[sku] = {
      orders: refs.map((r) => r.order),
      fileIds: refs.map((r) => r.fileId),
      count: refs.length,
    }
  }

  const out = {
    foldersScanned: result.foldersScanned,
    imagesSeen: result.imagesSeen,
    imagesMatched: result.imagesMatched,
    skuCount: result.bySku.size,
    placeholderFileId: result.placeholderFileId,
    warnings: result.warnings.slice(0, 80),
    warningCount: result.warnings.length,
    bySku,
    elapsedMs: Date.now() - started,
  }

  const path = resolve(
    '/Users/vasilii/Desktop/code /muru-docs/audits/catalog-parity-2026-07-28/drive_scan.json',
  )
  writeFileSync(path, JSON.stringify(out, null, 2))
  console.log(
    JSON.stringify(
      {
        foldersScanned: out.foldersScanned,
        imagesSeen: out.imagesSeen,
        imagesMatched: out.imagesMatched,
        skuCount: out.skuCount,
        warningCount: out.warningCount,
        elapsedMs: out.elapsedMs,
        out: path,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
