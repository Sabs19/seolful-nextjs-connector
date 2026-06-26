import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import { getStorage } from './storage/index.js'
import { performHandshake } from './cli/handshake.js'

let registering: Promise<void> | null = null

function randomString(length: number): string {
  return randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length)
}

function decodeKey(key: string): { url: string; tok: string } | null {
  try {
    const padded = key.replace(/-/g, '+').replace(/_/g, '/')
    const json = Buffer.from(padded, 'base64').toString('utf8')
    const decoded = JSON.parse(json)
    if (!decoded.url) return null
    return { url: decoded.url.replace(/\/$/, ''), tok: decoded.tok ?? '' }
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

  const clientId = randomString(12)
  const token = randomString(40)

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
