import { getStorage } from '../storage/index.js'
import { getConfig } from '../config.js'
import type { SeoPage } from '../types.js'

export async function getPageSeo(pathname: string): Promise<SeoPage | null> {
  const config = getConfig()
  const siteUrl = config.siteUrl.replace(/\/$/, '')
  const fullUrl = siteUrl + pathname

  const storage = getStorage()
  return storage.getPageByUrl(fullUrl)
}
