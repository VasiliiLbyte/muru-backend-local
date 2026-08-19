/**
 * Scan a specific Drive folder (not env root) for product images by SKU naming.
 * Usage: npx tsx scripts/scan-drive-folder-once.ts <folderId>
 */
import { writeFileSync } from 'fs'

import { google } from 'googleapis'

import {
  acceptsImageInFolder,
  classifyDriveFolder,
  isIgnoredDriveFolder,
  normalizeDriveImageBasename,
  parseDriveImageFilename,
} from '../src/services/google-drive-filename.ts'
import { env } from '../src/utils/env.ts'

const folderId = process.argv[2] || '1okABaQzSC-f9H6epKfhMH8sIImE2gLcQ'

type Hit = {
  fileId: string
  fileName: string
  parentFolderName: string
  parentFolderId: string
  path: string
}

async function listChildren(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const out: Array<{ id: string; name: string; mimeType: string }> = []
  let pageToken: string | undefined
  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    for (const f of res.data.files || []) {
      if (f.id && f.name && f.mimeType) {
        out.push({ id: f.id, name: f.name, mimeType: f.mimeType })
      }
    }
    pageToken = res.data.nextPageToken || undefined
  } while (pageToken)
  return out
}

async function main() {
  const auth = new google.auth.JWT({
    email: env.googleServiceAccountEmail,
    key: env.googlePrivateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  const drive = google.drive({ version: 'v3', auth })

  // Resolve root folder name
  let rootName = folderId
  try {
    const meta = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType',
      supportsAllDrives: true,
    })
    rootName = meta.data.name || folderId
    console.log(`Root: ${rootName} (${folderId}) mime=${meta.data.mimeType}`)
  } catch (e) {
    console.error('Cannot access folder:', e instanceof Error ? e.message : e)
    process.exit(1)
  }

  const queue: Array<{ id: string; name: string; path: string }> = [
    { id: folderId, name: rootName, path: rootName },
  ]
  const imageHits: Hit[] = []
  const unmatchedImages: Array<{ name: string; path: string; id: string }> = []
  let foldersScanned = 0
  const folderNames = new Set<string>()

  while (queue.length) {
    const folder = queue.shift()!
    foldersScanned += 1
    folderNames.add(folder.name)
    if (foldersScanned % 50 === 0) {
      console.log(`folders=${foldersScanned} images=${imageHits.length} queue=${queue.length}`)
    }
    const children = await listChildren(drive, folder.id)
    for (const child of children) {
      if (child.mimeType === 'application/vnd.google-apps.folder') {
        queue.push({
          id: child.id,
          name: child.name,
          path: `${folder.path}/${child.name}`,
        })
        continue
      }
      if (!child.mimeType.startsWith('image/')) continue

      const parsed = parseDriveImageFilename(normalizeDriveImageBasename(child.name))
      if (!parsed) {
        // also try loose MU#### anywhere in name
        const loose = child.name.match(/(MU\d{4})/i)
        unmatchedImages.push({
          name: child.name,
          path: folder.path,
          id: child.id,
        })
        if (loose) {
          imageHits.push({
            fileId: child.id,
            fileName: child.name,
            parentFolderName: folder.name,
            parentFolderId: folder.id,
            path: `${folder.path}/${child.name}`,
          })
        }
        continue
      }

      const folderKind = classifyDriveFolder(folder.name)
      // Accept even outside strict folder kinds for this exploratory scan,
      // but mark folder kind.
      imageHits.push({
        fileId: child.id,
        fileName: child.name,
        parentFolderName: folder.name,
        parentFolderId: folder.id,
        path: `${folder.path}/${child.name}`,
      })
      void folderKind
      void acceptsImageInFolder
      void isIgnoredDriveFolder
    }
  }

  // Build bySku using parseDriveImageFilename when possible, else loose MU in name
  const bySku = new Map<
    string,
    Array<{ order: number; fileId: string; fileName: string; path: string; format: string }>
  >()

  for (const hit of imageHits) {
    const parsed = parseDriveImageFilename(normalizeDriveImageBasename(hit.fileName))
    if (parsed) {
      const list = bySku.get(parsed.sku) || []
      if (!list.some((x) => x.order === parsed.order && x.fileId === hit.fileId)) {
        list.push({
          order: parsed.order,
          fileId: hit.fileId,
          fileName: hit.fileName,
          path: hit.path,
          format: parsed.format,
        })
      }
      bySku.set(parsed.sku, list)
      continue
    }
    const loose = hit.fileName.match(/(MU\d{4})/i)
    if (loose) {
      const sku = loose[1].toUpperCase()
      const list = bySku.get(sku) || []
      const order = list.length + 1
      list.push({
        order,
        fileId: hit.fileId,
        fileName: hit.fileName,
        path: hit.path,
        format: 'loose',
      })
      bySku.set(sku, list)
    }
  }

  for (const [, refs] of bySku) {
    refs.sort((a, b) => a.order - a.order || a.order - b.order)
    refs.sort((a, b) => a.order - b.order)
  }

  const bySkuObj: Record<string, unknown> = {}
  for (const [sku, refs] of [...bySku.entries()].sort()) {
    bySkuObj[sku] = {
      count: refs.length,
      orders: refs.map((r) => r.order),
      files: refs.map((r) => ({
        order: r.order,
        fileId: r.fileId,
        fileName: r.fileName,
        path: r.path,
        format: r.format,
      })),
    }
  }

  // Top-level structure sample
  const topChildren = await listChildren(drive, folderId)

  const out = {
    folderId,
    rootName,
    foldersScanned,
    imageHits: imageHits.length,
    unmatchedImageCount: unmatchedImages.length,
    unmatchedSample: unmatchedImages.slice(0, 40),
    skuCount: bySku.size,
    skuMin: bySku.size ? [...bySku.keys()].sort()[0] : null,
    skuMax: bySku.size ? [...bySku.keys()].sort().at(-1) : null,
    topLevel: topChildren.map((c) => ({
      name: c.name,
      type: c.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
    })),
    folderNameSample: [...folderNames].slice(0, 80),
    bySku: bySkuObj,
  }

  const path =
    '/Users/vasilii/Desktop/code /muru-docs/audits/catalog-parity-2026-07-28/drive_folder_1okABaQz.json'
  writeFileSync(path, JSON.stringify(out, null, 2))
  console.log(
    JSON.stringify(
      {
        rootName,
        foldersScanned,
        imageHits: imageHits.length,
        unmatchedImages: unmatchedImages.length,
        skuCount: bySku.size,
        skuMin: out.skuMin,
        skuMax: out.skuMax,
        topLevelFolders: topChildren.filter((c) => c.mimeType.includes('folder')).map((c) => c.name),
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
