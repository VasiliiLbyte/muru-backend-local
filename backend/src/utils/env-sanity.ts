import { readFileSync } from 'node:fs'

import dotenv from 'dotenv'

export const ENV_SANITY_KEY_THRESHOLD = 40

export type EnvSanityInput = {
  fileKeyCount: number
  filePort?: string
  fileCatalogSource?: string
  processPort?: string
  processCatalogSource?: string
  effectivePort: number
  effectiveCatalogSource: string
  nodeEnv: string
}

export const formatEnvCheckLine = (input: {
  keys: number
  port: number
  catalogSource: string
}): string =>
  `[env-check] keys=${input.keys} PORT=${input.port} CATALOG_SOURCE=${input.catalogSource}`

export const collectEnvSanityWarnings = (input: EnvSanityInput): string[] => {
  const warnings: string[] = []

  if (input.fileKeyCount < ENV_SANITY_KEY_THRESHOLD) {
    warnings.push(
      `[env-check][WARN] .env key count ${input.fileKeyCount} < ${ENV_SANITY_KEY_THRESHOLD} (possible truncated file)`,
    )
  }

  const filePort = input.filePort ?? ''
  const processPort = input.processPort ?? ''
  if (filePort !== processPort) {
    warnings.push(
      `[env-check][WARN] PORT mismatch: file=${filePort || '(empty)'} process=${processPort || '(empty)'} (stale PM2 env?)`,
    )
  }

  const fileCatalog = input.fileCatalogSource ?? ''
  const processCatalog = input.processCatalogSource ?? ''
  if (fileCatalog !== processCatalog) {
    warnings.push(
      `[env-check][WARN] CATALOG_SOURCE mismatch: file=${fileCatalog || '(empty)'} process=${processCatalog || '(empty)'} (stale PM2 env?)`,
    )
  }

  if (input.nodeEnv === 'production') {
    const isStagingPort = input.effectivePort === 4001
    if (input.effectivePort !== 4000 && !isStagingPort) {
      warnings.push(
        `[env-check][WARN] production PORT=${input.effectivePort} expected 4000 (or 4001 staging)`,
      )
    }
    if (!isStagingPort && input.effectiveCatalogSource !== 'crm') {
      warnings.push(
        `[env-check][WARN] production CATALOG_SOURCE=${input.effectiveCatalogSource} expected crm`,
      )
    }
  }

  return warnings
}

export const parseDotenvFile = (path: string): Record<string, string> =>
  dotenv.parse(readFileSync(path))

export const runEnvSanityCheck = (opts: {
  envFilePath?: string
  effectivePort: number
  effectiveCatalogSource: string
  nodeEnv: string
}): void => {
  let fileEnv: Record<string, string> = {}
  if (opts.envFilePath) {
    try {
      fileEnv = parseDotenvFile(opts.envFilePath)
    } catch {
      fileEnv = {}
    }
  }

  const keys = Object.keys(fileEnv).length
  console.log(
    formatEnvCheckLine({
      keys,
      port: opts.effectivePort,
      catalogSource: opts.effectiveCatalogSource,
    }),
  )

  const warnings = collectEnvSanityWarnings({
    fileKeyCount: keys,
    filePort: fileEnv.PORT,
    fileCatalogSource: fileEnv.CATALOG_SOURCE,
    processPort: process.env.PORT,
    processCatalogSource: process.env.CATALOG_SOURCE,
    effectivePort: opts.effectivePort,
    effectiveCatalogSource: opts.effectiveCatalogSource,
    nodeEnv: opts.nodeEnv,
  })
  for (const warning of warnings) {
    console.warn(warning)
  }
}
