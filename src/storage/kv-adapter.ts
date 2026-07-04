import { Redis } from '@upstash/redis'
import type { StorageAdapter, SeolfulConnection, SeoPage } from '../types.js'

interface PagesStore {
  nextId: number
  pages: SeoPage[]
}

const CONNECTION_KEY = 'seolful:connection'
const PAGES_KEY = 'seolful:pages'
const LOCK_PREFIX = 'seolful:lock:'

/**
 * Redis-backed storage (Upstash REST API, e.g. via Vercel's Redis marketplace
 * integration). Durable across serverless instances, unlike FileAdapter's
 * local /tmp storage which doesn't survive cold starts or concurrent
 * invocations on separate containers.
 */
export class KvAdapter implements StorageAdapter {
  private redis: Redis

  constructor(redis?: Redis) {
    this.redis = redis ?? Redis.fromEnv()
  }

  // -- Connection --

  async getConnection(): Promise<SeolfulConnection | null> {
    const conn = await this.redis.get<SeolfulConnection>(CONNECTION_KEY)
    if (!conn?.clientId) return null
    return conn
  }

  async saveConnection(conn: SeolfulConnection): Promise<void> {
    await this.redis.set(CONNECTION_KEY, conn)
  }

  async deleteConnection(): Promise<void> {
    await this.redis.del(CONNECTION_KEY)
  }

  // -- Pages --

  private async loadPages(): Promise<PagesStore> {
    const store = await this.redis.get<PagesStore>(PAGES_KEY)
    return store ?? { nextId: 1, pages: [] }
  }

  private async savePages(store: PagesStore): Promise<void> {
    await this.redis.set(PAGES_KEY, store)
  }

  async getPageByUrl(url: string): Promise<SeoPage | null> {
    const store = await this.loadPages()
    return store.pages.find((p) => p.url === url) ?? null
  }

  async getPageById(id: number): Promise<SeoPage | null> {
    const store = await this.loadPages()
    return store.pages.find((p) => p.id === id) ?? null
  }

  async getAllPages(page: number, perPage: number): Promise<{ data: SeoPage[]; total: number }> {
    const store = await this.loadPages()
    const start = (page - 1) * perPage
    return {
      data: store.pages.slice(start, start + perPage),
      total: store.pages.length,
    }
  }

  async upsertPage(page: Omit<SeoPage, 'id'>): Promise<SeoPage> {
    const store = await this.loadPages()
    const idx = store.pages.findIndex((p) => p.url === page.url)

    if (idx >= 0) {
      const existing = store.pages[idx]
      store.pages[idx] = { ...existing, ...page, id: existing.id }
      await this.savePages(store)
      return store.pages[idx]
    }

    const newPage: SeoPage = { ...page, id: store.nextId++ }
    store.pages.push(newPage)
    await this.savePages(store)
    return newPage
  }

  async upsertPages(pages: Array<Omit<SeoPage, 'id'>>): Promise<void> {
    const store = await this.loadPages()

    for (const page of pages) {
      const idx = store.pages.findIndex((p) => p.url === page.url)
      if (idx >= 0) {
        const existing = store.pages[idx]
        store.pages[idx] = { ...existing, ...page, id: existing.id }
      } else {
        store.pages.push({ ...page, id: store.nextId++ })
      }
    }

    await this.savePages(store)
  }

  // -- Locks --
  // Uses Redis's native atomic SET NX PX instead of a read-modify-write JSON
  // blob, so lock acquisition is race-free across concurrent invocations.

  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    const result = await this.redis.set(LOCK_PREFIX + key, '1', { nx: true, px: ttlMs })
    return result === 'OK'
  }

  async releaseLock(key: string): Promise<void> {
    await this.redis.del(LOCK_PREFIX + key)
  }
}
