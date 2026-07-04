import { getStorageDir } from '../config.js'
import { FileAdapter } from './file-adapter.js'
import { KvAdapter } from './kv-adapter.js'
import type { StorageAdapter } from '../types.js'

let instance: StorageAdapter | null = null

function hasRedisEnv(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  return Boolean(url && token)
}

// Serverless platforms (Vercel) recycle instances and don't share a local
// filesystem across them, so FileAdapter's /tmp storage silently loses data
// between requests. Prefer Redis (Upstash / Vercel's Redis marketplace
// integration) whenever it's configured; fall back to FileAdapter for local
// dev or self-hosted deployments where local disk actually persists.
export function getStorage(): StorageAdapter {
  if (!instance) {
    instance = hasRedisEnv() ? new KvAdapter() : new FileAdapter(getStorageDir())
  }
  return instance
}

export function setStorage(adapter: StorageAdapter): void {
  instance = adapter
}
