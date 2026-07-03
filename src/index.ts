// Types
export type {
  SeolfulConfig,
  SeolfulConnection,
  SeoPage,
  ImageAlt,
  StorageAdapter,
} from './types.js'

export { getPageRole, getContentType } from './types.js'

// Config
export { getConfig, getStorageDir, clearConfigCache } from './config.js'

// Storage
export { getStorage, setStorage } from './storage/index.js'
export { FileAdapter } from './storage/file-adapter.js'

// Auto-registration (called from the consumer's instrumentation.ts)
export { ensureRegistered } from './auto-register.js'

// Helpers — user-facing
export { getPageSeo } from './helpers/get-page-seo.js'
export { withSeolfulMetadata } from './helpers/generate-metadata.js'
export { SeolfulImage } from './helpers/seolful-image.js'
export { SeolfulSchema } from './helpers/seolful-schema.js'
export { SeolfulH1 } from './helpers/seolful-h1.js'
