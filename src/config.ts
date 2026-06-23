import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SeolfulConfig } from './types.js'

let cached: SeolfulConfig | null = null

export function getStorageDir(): string {
  if (process.env.SEOLFUL_STORAGE_DIR) return process.env.SEOLFUL_STORAGE_DIR
  if (process.env.VERCEL === '1') return '/tmp/.seolful'
  return join(process.cwd(), '.seolful')
}

export function getConfig(): SeolfulConfig {
  if (cached) return cached

  const storageDir = getStorageDir()
  const configPath = join(storageDir, 'config.json')

  let fileConfig: Partial<SeolfulConfig> = {}
  if (existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(readFileSync(configPath, 'utf8'))
    } catch {
      // Ignore malformed config
    }
  }

  cached = {
    appUrl: process.env.SEOLFUL_APP_URL ?? fileConfig.appUrl ?? '',
    siteUrl: process.env.SEOLFUL_SITE_URL ?? fileConfig.siteUrl ?? '',
    siteName: process.env.SEOLFUL_SITE_NAME ?? fileConfig.siteName ?? '',
    connectionKey: process.env.SEOLFUL_CONNECTION_KEY ?? fileConfig.connectionKey,
    storageDir,
    crawl: {
      urls: fileConfig.crawl?.urls ?? [],
      sitemapUrl: process.env.SEOLFUL_SITEMAP_URL ?? fileConfig.crawl?.sitemapUrl,
      useSitemap: fileConfig.crawl?.useSitemap ?? true,
      delayMs: Number(process.env.SEOLFUL_CRAWL_DELAY_MS ?? fileConfig.crawl?.delayMs ?? 300),
      timeout: Number(process.env.SEOLFUL_CRAWL_TIMEOUT ?? fileConfig.crawl?.timeout ?? 10),
    },
  }

  return cached
}

export function clearConfigCache(): void {
  cached = null
}
