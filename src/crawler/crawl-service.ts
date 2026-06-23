import { getConfig } from '../config.js'
import { getStorage } from '../storage/index.js'
import { discoverUrls } from './discover.js'
import { analyzePage } from './analyze.js'
import type { SeoPage } from '../types.js'

const LOCK_TTL_MS = 300_000 // 5 minutes
const BATCH_SIZE = 20

interface CrawlResult {
  crawled: number
  failed: number
  total: number
  firstError: string | null
  discoveryMethod: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function crawlSite(): Promise<CrawlResult> {
  const storage = getStorage()
  const locked = await storage.acquireLock('crawling', LOCK_TTL_MS)

  if (!locked) {
    return {
      crawled: 0,
      failed: 0,
      total: 0,
      firstError: 'A crawl is already in progress.',
      discoveryMethod: 'skipped',
    }
  }

  try {
    return await doCrawl()
  } finally {
    await storage.releaseLock('crawling')
  }
}

async function doCrawl(): Promise<CrawlResult> {
  const config = getConfig()
  const storage = getStorage()
  const delayMs = config.crawl?.delayMs ?? 300
  const timeout = (config.crawl?.timeout ?? 10) * 1000

  const { urls, method } = await discoverUrls()
  const total = urls.length
  let crawled = 0
  let failed = 0
  let firstError: string | null = null

  const batch: Array<Omit<SeoPage, 'id'>> = []

  for (const url of urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeout) })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const html = await response.text()
      const analysis = analyzePage(url, html)

      batch.push({
        ...analysis,
        demoteH1: false,
        crawledAt: new Date().toISOString(),
      })
      crawled++
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      firstError ??= message
      failed++
    }

    if (batch.length >= BATCH_SIZE) {
      await storage.upsertPages(batch)
      batch.length = 0
    }

    if (delayMs > 0) {
      await sleep(delayMs)
    }
  }

  if (batch.length > 0) {
    await storage.upsertPages(batch)
  }

  return {
    crawled,
    failed,
    total,
    firstError,
    discoveryMethod: method,
  }
}
