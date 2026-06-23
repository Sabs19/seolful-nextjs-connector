import { parse, HTMLElement } from 'node-html-parser'
import type { ImageAlt } from '../types.js'

export interface PageAnalysis {
  url: string
  slug: string
  title: string | null
  metaDescription: string | null
  h1: string | null
  h1Count: number
  h1Secondary: string | null
  wordCount: number
  imageAlts: ImageAlt[]
  internalLinkCount: number
  structuredData: object[]
  noindex: boolean
  canonicalUrl: string | null
}

export function analyzePage(url: string, html: string): PageAnalysis {
  const root = parse(html)

  const h1s = extractAllH1s(root)
  const pathname = safePathname(url)

  return {
    url,
    slug: pathname,
    title: extractTitle(root),
    metaDescription: extractMetaDescription(root),
    h1: h1s[0] ?? null,
    h1Count: h1s.length,
    h1Secondary: h1s[1] ?? null,
    wordCount: countWords(root),
    imageAlts: extractImageAlts(root),
    internalLinkCount: countInternalLinks(root, url),
    structuredData: extractStructuredData(root),
    noindex: detectNoindex(root),
    canonicalUrl: extractCanonical(root),
  }
}

function safePathname(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return '/'
  }
}

function extractTitle(root: HTMLElement): string | null {
  const title = root.querySelector('title')
  const text = title?.textContent?.trim()
  return text || null
}

function extractMetaDescription(root: HTMLElement): string | null {
  const meta = root.querySelector('meta[name="description"]')
  const content = meta?.getAttribute('content')?.trim()
  return content || null
}

function extractAllH1s(root: HTMLElement): string[] {
  return root
    .querySelectorAll('h1')
    .map((el) => el.textContent.trim())
    .filter(Boolean)
}

function countWords(root: HTMLElement): number {
  const body = root.querySelector('body')
  if (!body) return 0

  // Remove script and style elements
  for (const el of body.querySelectorAll('script, style')) {
    el.remove()
  }

  const text = body.textContent.replace(/\s+/g, ' ').trim()
  if (!text) return 0
  return text.split(/\s+/).length
}

function extractImageAlts(root: HTMLElement): ImageAlt[] {
  return root.querySelectorAll('img').reduce<ImageAlt[]>((acc, img) => {
    const src = img.getAttribute('src') || img.getAttribute('data-src')
    if (!src) return acc

    const alt = img.getAttribute('alt') ?? ''
    acc.push({ src, alt, missing: alt === '' })
    return acc
  }, [])
}

function countInternalLinks(root: HTMLElement, pageUrl: string): number {
  let host = ''
  try {
    host = new URL(pageUrl).host
  } catch {
    return 0
  }

  let count = 0
  for (const a of root.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') ?? ''
    if (href.startsWith('/') || href.includes(host)) {
      count++
    }
  }
  return count
}

function extractStructuredData(root: HTMLElement): object[] {
  const schemas: object[] = []
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const decoded = JSON.parse(script.textContent)
      if (decoded && typeof decoded === 'object') {
        schemas.push(decoded)
      }
    } catch {
      // skip malformed JSON-LD
    }
  }
  return schemas
}

function detectNoindex(root: HTMLElement): boolean {
  for (const name of ['robots', 'googlebot']) {
    const meta = root.querySelector(`meta[name="${name}"]`)
    const content = meta?.getAttribute('content')?.toLowerCase() ?? ''
    if (content.includes('noindex')) return true
  }
  return false
}

function extractCanonical(root: HTMLElement): string | null {
  const link = root.querySelector('link[rel="canonical"]')
  return link?.getAttribute('href') ?? null
}
