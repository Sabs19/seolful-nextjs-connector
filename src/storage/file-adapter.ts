import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { StorageAdapter, SeolfulConnection, SeoPage } from '../types.js'

interface PagesStore {
  nextId: number
  pages: SeoPage[]
}

interface LocksStore {
  [key: string]: { expiresAt: number }
}

export class FileAdapter implements StorageAdapter {
  private dir: string

  constructor(storageDir: string) {
    this.dir = storageDir
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true })
    }
  }

  private path(file: string): string {
    return join(this.dir, file)
  }

  private readJson<T>(file: string, fallback: T): T {
    const p = this.path(file)
    if (!existsSync(p)) return fallback
    try {
      return JSON.parse(readFileSync(p, 'utf8'))
    } catch {
      return fallback
    }
  }

  private writeJson(file: string, data: unknown): void {
    const p = this.path(file)
    const dir = dirname(p)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const tmp = p + '.' + randomUUID() + '.tmp'
    writeFileSync(tmp, JSON.stringify(data, null, 2))
    renameSync(tmp, p)
  }

  // -- Connection --

  async getConnection(): Promise<SeolfulConnection | null> {
    const conn = this.readJson<SeolfulConnection | null>('connection.json', null)
    if (!conn?.clientId) return null
    return conn
  }

  async saveConnection(conn: SeolfulConnection): Promise<void> {
    this.writeJson('connection.json', conn)
  }

  async deleteConnection(): Promise<void> {
    const p = this.path('connection.json')
    if (existsSync(p)) unlinkSync(p)
  }

  // -- Pages --

  private loadPages(): PagesStore {
    return this.readJson<PagesStore>('pages.json', { nextId: 1, pages: [] })
  }

  private savePages(store: PagesStore): void {
    this.writeJson('pages.json', store)
  }

  async getPageByUrl(url: string): Promise<SeoPage | null> {
    const store = this.loadPages()
    return store.pages.find((p) => p.url === url) ?? null
  }

  async getPageById(id: number): Promise<SeoPage | null> {
    const store = this.loadPages()
    return store.pages.find((p) => p.id === id) ?? null
  }

  async getAllPages(page: number, perPage: number): Promise<{ data: SeoPage[]; total: number }> {
    const store = this.loadPages()
    const start = (page - 1) * perPage
    return {
      data: store.pages.slice(start, start + perPage),
      total: store.pages.length,
    }
  }

  async upsertPage(page: Omit<SeoPage, 'id'>): Promise<SeoPage> {
    const store = this.loadPages()
    const idx = store.pages.findIndex((p) => p.url === page.url)

    if (idx >= 0) {
      const existing = store.pages[idx]
      store.pages[idx] = { ...existing, ...page, id: existing.id }
      this.savePages(store)
      return store.pages[idx]
    }

    const newPage: SeoPage = { ...page, id: store.nextId++ }
    store.pages.push(newPage)
    this.savePages(store)
    return newPage
  }

  async upsertPages(pages: Array<Omit<SeoPage, 'id'>>): Promise<void> {
    const store = this.loadPages()

    for (const page of pages) {
      const idx = store.pages.findIndex((p) => p.url === page.url)
      if (idx >= 0) {
        const existing = store.pages[idx]
        store.pages[idx] = { ...existing, ...page, id: existing.id }
      } else {
        store.pages.push({ ...page, id: store.nextId++ })
      }
    }

    this.savePages(store)
  }

  // -- Locks --

  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    const locks = this.readJson<LocksStore>('locks.json', {})
    const existing = locks[key]

    if (existing && existing.expiresAt > Date.now()) {
      return false
    }

    locks[key] = { expiresAt: Date.now() + ttlMs }
    this.writeJson('locks.json', locks)
    return true
  }

  async releaseLock(key: string): Promise<void> {
    const locks = this.readJson<LocksStore>('locks.json', {})
    delete locks[key]
    this.writeJson('locks.json', locks)
  }
}
