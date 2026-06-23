import { getConfig } from '../config.js'

export async function discoverUrls(): Promise<{ urls: string[]; method: string }> {
  const config = getConfig()
  const siteUrl = config.siteUrl.replace(/\/$/, '')

  const explicit = config.crawl?.urls ?? []
  if (explicit.length > 0) {
    return { urls: explicit, method: 'config list' }
  }

  if (config.crawl?.useSitemap !== false) {
    const sitemapUrl = config.crawl?.sitemapUrl ?? `${siteUrl}/sitemap.xml`
    const urls = await parseSitemap(sitemapUrl)
    if (urls.length > 0) {
      return { urls, method: 'sitemap.xml' }
    }
  }

  return { urls: [siteUrl + '/'], method: 'root only' }
}

async function parseSitemap(url: string, depth = 0): Promise<string[]> {
  if (depth > 3) return []

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) return []

    const body = await response.text()
    const urls: string[] = []

    // Extract <loc> from <url> entries
    const locMatches = body.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/gs)
    for (const match of locMatches) {
      const loc = match[1].trim()
      if (loc) urls.push(loc)
    }

    // Handle sitemap index — <sitemap><loc>...</loc></sitemap>
    const sitemapMatches = body.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/gs)
    for (const match of sitemapMatches) {
      const loc = match[1].trim()
      if (loc) {
        const childUrls = await parseSitemap(loc, depth + 1)
        urls.push(...childUrls)
      }
    }

    return [...new Set(urls)]
  } catch {
    return []
  }
}
