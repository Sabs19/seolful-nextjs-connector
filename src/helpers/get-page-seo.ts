import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SeoOverride, SeoOverridesFile } from '../types.js'

const OVERRIDES_FILENAME = 'seolful.overrides.json'

let cached: SeoOverridesFile | null = null

/**
 * Fixes are committed to seolful.overrides.json by the Seolful GitHub App
 * (via a PR the customer merges) rather than written at request time —
 * reading a file bundled into the deployment is safe on Vercel's read-only
 * filesystem, unlike the runtime writes this used to depend on.
 */
function loadOverrides(): SeoOverridesFile {
  if (cached) return cached

  try {
    const raw = readFileSync(join(process.cwd(), OVERRIDES_FILENAME), 'utf8')
    cached = JSON.parse(raw) as SeoOverridesFile
  } catch {
    cached = {}
  }

  return cached
}

export async function getPageSeo(pathname: string): Promise<SeoOverride | null> {
  const overrides = loadOverrides()
  return overrides[pathname] ?? null
}
