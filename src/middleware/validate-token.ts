import bcrypt from 'bcryptjs'
import { getStorage } from '../storage/index.js'
import { ensureRegistered, decodeKey } from '../auto-register.js'

export async function validateToken(
  headers: Headers,
): Promise<{ valid: true } | { valid: false; status: number; error: string }> {
  const token = headers.get('x-seolful-token')
  const clientId = headers.get('x-seolful-client-id')

  if (!token || !clientId) {
    return { valid: false, status: 401, error: 'Unauthorized' }
  }

  // Primary path: SEOLFUL_KEY carries the app-issued client_id/token directly,
  // so every instance can compare inline with no dependency on local storage
  // or on registration having already run. This is what makes auth work
  // reliably on serverless deployments — storage (file-adapter, backed by
  // /tmp on Vercel) is ephemeral and not shared across instances/cold starts,
  // and without this, concurrently-warm instances that each self-invented
  // their own credentials could disagree with whatever the app last stored.
  const key = process.env.SEOLFUL_KEY
  if (key) {
    const decoded = decodeKey(key)
    if (decoded?.id && decoded.tok) {
      if (clientId === decoded.id && token === decoded.tok) {
        return { valid: true }
      }
      return { valid: false, status: 401, error: 'Unauthorized' }
    }
  }

  // Legacy env vars (explicit client_id + token), also storage-free
  const envClientId = process.env.SEOLFUL_CLIENT_ID
  const envToken = process.env.SEOLFUL_TOKEN
  if (envClientId && envToken) {
    if (clientId === envClientId && token === envToken) {
      return { valid: true }
    }
    return { valid: false, status: 401, error: 'Unauthorized' }
  }

  // Legacy fallback: local file storage, only reliable on a persistent
  // filesystem (self-hosted/Docker). Registration normally happens on server
  // startup via the instrumentation.ts hook, but attempt it here too in case
  // that hook isn't wired up in this deployment (or hasn't finished yet).
  if (key) {
    await ensureRegistered()
  }

  const storage = getStorage()
  const connection = await storage.getConnection()

  if (!connection || connection.clientId !== clientId) {
    return { valid: false, status: 401, error: 'Unauthorized' }
  }

  const match = await bcrypt.compare(token, connection.tokenHash)
  if (!match) {
    return { valid: false, status: 401, error: 'Unauthorized' }
  }

  return { valid: true }
}
