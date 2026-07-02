import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import { getStorage } from './storage/index.js'
import { performHandshake } from './cli/handshake.js'

let registering: Promise<void> | null = null

export function decodeKey(key: string): { url: string; id: string; tok: string } | null {
  try {
    const padded = key.replace(/-/g, '+').replace(/_/g, '/')
    const json = Buffer.from(padded, 'base64').toString('utf8')
    const decoded = JSON.parse(json)
    if (!decoded.url) return null
    return { url: decoded.url.replace(/\/$/, ''), id: decoded.id ?? '', tok: decoded.tok ?? '' }
  } catch {
    return null
  }
}

function getPackageVersion(): string {
  try {
    const dir = dirname(fileURLToPath(import.meta.url))
    const pkg = JSON.parse(readFileSync(join(dir, '..', 'package.json'), 'utf8'))
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export async function ensureRegistered(): Promise<boolean> {
  const key = process.env.SEOLFUL_KEY
  if (!key) return false

  // Already have credentials — skip
  if (process.env.SEOLFUL_CLIENT_ID && process.env.SEOLFUL_TOKEN) return true

  const storage = getStorage()
  const existing = await storage.getConnection()
  if (existing?.clientId) return true

  // Deduplicate concurrent registrations
  if (registering) {
    await registering
    return true
  }

  registering = doRegister(key, storage)
  try {
    await registering
    return true
  } catch {
    return false
  } finally {
    registering = null
  }
}

async function doRegister(key: string, storage: Awaited<ReturnType<typeof getStorage>>): Promise<void> {
  const decoded = decodeKey(key)
  if (!decoded) throw new Error('Invalid SEOLFUL_KEY')
  if (!decoded.id || !decoded.tok) {
    throw new Error('This connection key is in an old format — copy a fresh one from your Seolful dashboard.')
  }

  // The app mints client_id/token up front and hands them to us via the
  // connection key — we no longer invent our own, which is what lets the
  // SEOLFUL_KEY-based auth check in validate-token.ts work without ever
  // reading from local (and on serverless, ephemeral) storage.
  const clientId = decoded.id
  const token = decoded.tok

  const siteUrl = process.env.SEOLFUL_SITE_URL
    || `http://localhost:${process.env.PORT || 3000}`

  const version = await getPackageVersion()

  await performHandshake(decoded.url, {
    clientId,
    token,
    siteUrl,
    siteName: process.env.SEOLFUL_SITE_NAME || 'Next.js Site',
    connectionKey: key,
    connectorVersion: version,
  })

  const tokenHash = await bcrypt.hash(token, 10)
  await storage.saveConnection({
    clientId,
    tokenHash,
    siteUrl,
    connectedAt: new Date().toISOString(),
  })
}
