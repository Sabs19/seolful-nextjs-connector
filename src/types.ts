export interface SeolfulConfig {
  appUrl: string
  siteUrl: string
  siteName: string
  connectionKey?: string
  storageDir?: string
  crawl?: {
    urls?: string[]
    sitemapUrl?: string
    useSitemap?: boolean
    delayMs?: number
    timeout?: number
  }
}

export interface SeolfulConnection {
  clientId: string
  tokenHash: string
  siteUrl: string
  connectedAt: string
}

export interface ImageAlt {
  src: string
  alt: string
  missing: boolean
}

export interface SeoPage {
  id: number
  url: string
  slug: string
  title: string | null
  metaDescription: string | null
  h1: string | null
  h1Count: number
  h1Secondary: string | null
  demoteH1: boolean
  wordCount: number
  imageAlts: ImageAlt[]
  internalLinkCount: number
  structuredData: object[]
  noindex: boolean
  canonicalUrl: string | null
  crawledAt: string | null
}

/**
 * A published fix for one page, keyed by pathname in seolful.overrides.json.
 * Distinct from SeoPage: this is committed-to-git fix data (write side),
 * SeoPage is the crawl cache (read side) and stays in KvAdapter/FileAdapter.
 */
export interface SeoOverride {
  title?: string
  metaDescription?: string
  structuredData?: object[]
  demoteH1?: boolean
  imageAlts?: ImageAlt[]
}

export type SeoOverridesFile = Record<string, SeoOverride>

export interface StorageAdapter {
  getConnection(): Promise<SeolfulConnection | null>
  saveConnection(conn: SeolfulConnection): Promise<void>
  deleteConnection(): Promise<void>

  getPageByUrl(url: string): Promise<SeoPage | null>
  getPageById(id: number): Promise<SeoPage | null>
  getAllPages(page: number, perPage: number): Promise<{ data: SeoPage[]; total: number }>
  upsertPage(page: Omit<SeoPage, 'id'>): Promise<SeoPage>
  upsertPages(pages: Array<Omit<SeoPage, 'id'>>): Promise<void>

  acquireLock(key: string, ttlMs: number): Promise<boolean>
  releaseLock(key: string): Promise<void>
}

const LEGAL_EXACT = new Set([
  'privacy', 'terms', 'tos', 'cookie', 'cookies', 'disclaimer',
  'legal', 'refund', 'copyright', 'cancellation',
])

const LEGAL_SUBSTRING = [
  'privacy-policy', 'cookie-policy', 'terms-of-service', 'terms-and-conditions',
  'return-policy', 'refund-policy', 'cancellation-policy',
  'gdpr', 'dmca', 'accessibility',
]

const UTILITY_EXACT = new Set([
  'contact', 'contact-us', 'about', 'about-us', 'faq', 'faqs', 'search', 'sitemap',
])

const UTILITY_SUBSTRING = [
  'cart', 'checkout', 'my-account', 'wishlist', 'order-received',
  'login', 'log-in', 'register', 'sign-in', 'sign-up', 'signup',
  'lost-password', 'reset-password', 'forgot-password',
  'thank-you', 'thankyou',
  'coming-soon', 'maintenance', '404',
]

const PRODUCT_SECTIONS = new Set(['product', 'products', 'shop', 'store', 'item', 'items'])
const POST_SECTIONS = new Set(['blog', 'post', 'posts', 'news', 'article', 'articles', 'insights'])

function firstSegment(slug: string): string {
  const clean = (slug ?? '').toLowerCase().replace(/^\/|\/$/g, '')
  return clean === '' ? '' : clean.split('/')[0]
}

function hasDetailSegment(slug: string): boolean {
  const clean = (slug ?? '').toLowerCase().replace(/^\/|\/$/g, '')
  return clean !== '' && clean.includes('/')
}

/**
 * Classify a page as 'content', 'legal', 'utility', or 'product'. Next.js sites have no
 * native post-type field like a CMS would, so 'product' is inferred from URL shape
 * (e.g. /products/foo) rather than read from structured data.
 */
export function getPageRole(page: SeoPage): 'content' | 'legal' | 'utility' | 'product' {
  const slug = (page.slug ?? '').toLowerCase().replace(/^\/|\/$/g, '')
  const lastSegment = slug.split('/').pop() ?? ''

  if (LEGAL_EXACT.has(lastSegment)) return 'legal'
  if (LEGAL_SUBSTRING.some((p) => lastSegment.includes(p))) return 'legal'
  if (UTILITY_EXACT.has(lastSegment)) return 'utility'
  if (UTILITY_SUBSTRING.some((p) => lastSegment.includes(p))) return 'utility'
  if (hasDetailSegment(slug) && PRODUCT_SECTIONS.has(firstSegment(slug))) return 'product'
  if ((page.wordCount ?? 0) < 50) return 'utility'

  return 'content'
}

/**
 * Classify a page as 'post', 'product', or 'page' for content-type grouping in the
 * SaaS dashboard (as opposed to getPageRole(), which governs which audit rules apply).
 */
export function getContentType(page: SeoPage): 'post' | 'product' | 'page' {
  const role = getPageRole(page)
  if (role === 'product') return 'product'

  const slug = (page.slug ?? '').toLowerCase().replace(/^\/|\/$/g, '')
  if (hasDetailSegment(slug) && POST_SECTIONS.has(firstSegment(slug))) return 'post'

  return 'page'
}
