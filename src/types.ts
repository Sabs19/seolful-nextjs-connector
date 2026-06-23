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

export function getPageRole(page: SeoPage): 'content' | 'legal' | 'utility' {
  const slug = (page.slug ?? '').toLowerCase().replace(/^\/|\/$/g, '')
  const lastSegment = slug.split('/').pop() ?? ''

  if (LEGAL_EXACT.has(lastSegment)) return 'legal'
  if (LEGAL_SUBSTRING.some((p) => lastSegment.includes(p))) return 'legal'
  if (UTILITY_EXACT.has(lastSegment)) return 'utility'
  if (UTILITY_SUBSTRING.some((p) => lastSegment.includes(p))) return 'utility'
  if ((page.wordCount ?? 0) < 50) return 'utility'

  return 'content'
}
