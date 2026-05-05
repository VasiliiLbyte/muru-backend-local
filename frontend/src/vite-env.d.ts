/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_IDS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
