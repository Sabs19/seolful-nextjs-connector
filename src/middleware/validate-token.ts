import bcrypt from 'bcryptjs'
import { getStorage } from '../storage/index.js'
import { ensureRegistered } from '../auto-register.js'

export async function validateToken(
  headers: Headers,
): Promise<{ valid: true } | { valid: false; status: number; error: string }> {
  // SEOLFUL_KEY: registration normally happens on server startup via the
  // instrumentation.ts hook, but attempt it here too as a fallback in case
  // that hook isn't wired up in this deployment (or hasn't finished yet).
  if (process.env.SEOLFUL_KEY) {
    await ensureRegistered()
  }

  const token = headers.get('x-seolful-token')
  const clientId = headers.get('x-seolful-client-id')

  if (!token || !clientId) {
    return { valid: false, status: 401, error: 'Unauthorized' }
  }

  // Legacy env vars (explicit client_id + token)
  const envClientId = process.env.SEOLFUL_CLIENT_ID
  const envToken = process.env.SEOLFUL_TOKEN
  if (envClientId && envToken) {
    if (clientId === envClientId && token === envToken) {
      return { valid: true }
    }
    return { valid: false, status: 401, error: 'Unauthorized' }
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
