import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * seolful.overrides.json holds published fixes and must be committed —
 * the Seolful GitHub App opens PRs against it.
 */
export function scaffoldOverridesFile(cwd: string): string | null {
  const overridesPath = join(cwd, 'seolful.overrides.json')
  if (existsSync(overridesPath)) return null

  writeFileSync(overridesPath, JSON.stringify({}, null, 2) + '\n')
  return 'seolful.overrides.json'
}

export function injectIntoLayout(cwd: string): string | null {
  const useSrc = existsSync(join(cwd, 'src', 'app'))
  const appDir = useSrc ? join(cwd, 'src', 'app') : join(cwd, 'app')

  // Find the root layout file
  let layoutPath: string | null = null
  for (const ext of ['tsx', 'ts', 'jsx', 'js']) {
    const candidate = join(appDir, `layout.${ext}`)
    if (existsSync(candidate)) {
      layoutPath = candidate
      break
    }
  }

  if (!layoutPath) return null

  let content = readFileSync(layoutPath, 'utf8')

  // Already injected
  if (content.includes('@seolful/nextjs-connector') || content.includes('withSeolfulMetadata')) {
    return null
  }

  // Pattern: `export const metadata: Metadata = { ... };`
  // Convert to generateMetadata that wraps the static object with Seolful overrides
  const staticMetadataMatch = content.match(
    /export\s+const\s+metadata\s*(?::\s*Metadata\s*)?=\s*(\{[\s\S]*?\n\};?)/m
  )

  if (staticMetadataMatch) {
    const metadataObject = staticMetadataMatch[1].replace(/;$/, '')
    const fullMatch = staticMetadataMatch[0]

    // Add the import
    const seolfulImport = `import { withSeolfulMetadata } from '@seolful/nextjs-connector'\n`

    // Check if there's already an import from 'next' for Metadata type
    if (content.includes("import type { Metadata }")) {
      content = content.replace(
        /import type \{ Metadata \}[^\n]*\n/,
        (match) => match + seolfulImport,
      )
    } else if (content.includes("from 'next'") || content.includes('from "next"')) {
      // Add after the existing next import
      content = content.replace(
        /(from ['"]next['"][^\n]*\n)/,
        (match) => match + seolfulImport,
      )
    } else {
      // Add at the top
      content = seolfulImport + content
    }

    // Replace static metadata with generateMetadata function
    const replacement = `const baseMetadata = ${metadataObject}

export async function generateMetadata({ params }: { params: Promise<Record<string, string>> }) {
  return withSeolfulMetadata('/', baseMetadata)
}`

    content = content.replace(fullMatch, replacement)
    writeFileSync(layoutPath, content)

    const relative = useSrc ? 'src/app/layout.tsx' : 'app/layout.tsx'
    return relative
  }

  // Pattern: already has generateMetadata — wrap the return value
  if (content.includes('generateMetadata')) {
    // Too complex to auto-modify — skip
    return null
  }

  return null
}

const PAGE_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js']

/**
 * Same three checks as the backend's page-wiring detector, kept in sync by
 * hand since it's a different language — a static/dynamic metadata export
 * already covers the page; a false negative here would wrongly add a
 * duplicate that Next.js itself forbids (a file can't have both `metadata`
 * and `generateMetadata`), so this is intentionally biased toward assuming
 * metadata exists rather than missing it.
 */
function hasExistingMetadata(content: string): boolean {
  return (
    /\bgenerateMetadata\b/.test(content) ||
    /export\s+const\s+metadata\b/.test(content) ||
    /export\s*\{[^}]*\bmetadata\b[^}]*\}\s*from/.test(content)
  )
}

function isNonPublicSegment(segment: string): boolean {
  const bare = segment.replace(/^\(|\)$/g, '')
  return bare.toLowerCase() === 'admin' || bare.toLowerCase() === 'protected'
}

/**
 * A parallel-route slot (`@modal`, `@analytics`, ...) doesn't correspond to
 * a real URL segment at all — a page under one isn't a normal page the way
 * audit fixes ever target, so it's excluded from the walk entirely rather
 * than reported as needing setup.
 */
function isParallelRouteSegment(segment: string): boolean {
  return segment.startsWith('@')
}

function walkForPageFiles(dir: string): string[] {
  const found: string[] = []

  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue

    const full = join(dir, entry)
    const stat = statSync(full)

    if (stat.isDirectory()) {
      if (isNonPublicSegment(entry) || isParallelRouteSegment(entry)) continue
      found.push(...walkForPageFiles(full))
    } else if (PAGE_EXTENSIONS.some((ext) => entry === `page.${ext}`)) {
      found.push(full)
    }
  }

  return found
}

/**
 * Derives the route this file serves from its own location — no guessing
 * involved, unlike matching a URL back to a file. Bails (returns null) on
 * anything outside the narrow shape this can safely patch: a catch-all
 * segment, more than one dynamic segment, or the homepage itself (already
 * covered by the root layout's own generateMetadata).
 */
type RouteInfo =
  | { kind: 'homepage' }
  | { kind: 'unsupported' }
  | { kind: 'route'; pathname: string; dynamicParam: string | null }

/**
 * The homepage is genuinely nothing to report — the layout already covers
 * it. A catch-all or multi-dynamic route is different: it's a real gap, we
 * just can't confidently derive its pattern, so it must still come back as
 * "needs manual setup" rather than disappearing silently the way the
 * homepage does.
 */
function routeInfoForPageFile(absPath: string, appDir: string): RouteInfo {
  const rel = relative(appDir, absPath)
  const parts = rel.split(sep)
  parts.pop() // drop page.{ext} itself

  const routeParts = parts.filter((p) => !/^\(.+\)$/.test(p))

  if (routeParts.length === 0) return { kind: 'homepage' }

  let dynamicParam: string | null = null
  const segments: string[] = []

  for (const part of routeParts) {
    // Intercepting-route markers ((.)segment, (..)segment, (...)segment) are
    // parenthesized like a route group but aren't invisible the way a group
    // is — they change what route the file actually serves. Distinguishable
    // from a plain group because the paren is immediately followed by a dot,
    // which no ordinary group name would start with. Too easy to derive the
    // wrong pathname here, so this bails rather than guessing.
    if (/^\(\.+\)/.test(part)) return { kind: 'unsupported' }

    const catchAll = part.match(/^\[\.\.\.[a-zA-Z0-9_]+\]$/) || part.match(/^\[\[\.\.\.[a-zA-Z0-9_]+\]\]$/)
    if (catchAll) return { kind: 'unsupported' }

    const dynamic = part.match(/^\[([a-zA-Z0-9_]+)\]$/)
    if (dynamic) {
      if (dynamicParam) return { kind: 'unsupported' } // more than one dynamic segment
      dynamicParam = dynamic[1]
      segments.push(`\${${dynamicParam}}`)
    } else {
      segments.push(part)
    }
  }

  return { kind: 'route', pathname: '/' + segments.join('/'), dynamicParam }
}

function buildMetadataPatch(content: string, pathname: string, dynamicParam: string | null): string | null {
  if (content.includes("'use client'") || content.includes('"use client"')) return null // server-only feature
  if (content.includes('@seolful/nextjs-connector')) return null // already references the connector somehow
  if (!/^export\s+default\s+(async\s+)?function/m.test(content)) return null // unrecognized shape

  const fn = dynamicParam
    ? `export async function generateMetadata({ params }: { params: Promise<{ ${dynamicParam}: string }> }) {
  const { ${dynamicParam} } = await params
  return withSeolfulMetadata(\`${pathname}\`, {})
}

`
    : `export async function generateMetadata() {
  return withSeolfulMetadata('${pathname}', {})
}

`

  const withImport = `import { withSeolfulMetadata } from '@seolful/nextjs-connector'\n` + content

  return withImport.replace(/^export\s+default\s+(async\s+)?function/m, fn + '$&')
}

/**
 * Wires up every page that has no metadata setup at all — the same narrow
 * "recognize the safe shape or bail" pattern injectIntoLayout already uses
 * for the root layout, applied to individual page files. A page that
 * already has its own metadata logic is left alone entirely; so is anything
 * with a catch-all route, more than one dynamic segment, or a client
 * component — those are reported back so `init` can tell the user exactly
 * which pages still need manual setup, rather than leaving them to
 * discover it later after a fix sits unconfirmed for several minutes.
 */
export function wireUpPages(cwd: string): { wired: string[]; skipped: string[] } {
  const useSrc = existsSync(join(cwd, 'src', 'app'))
  const appDir = useSrc ? join(cwd, 'src', 'app') : join(cwd, 'app')

  if (!existsSync(appDir)) return { wired: [], skipped: [] }

  const wired: string[] = []
  const skipped: string[] = []

  for (const filePath of walkForPageFiles(appDir)) {
    const relativePath = (useSrc ? 'src/app/' : 'app/') + relative(appDir, filePath).split(sep).join('/')
    const route = routeInfoForPageFile(filePath, appDir)

    if (route.kind === 'homepage') {
      continue // nothing to report — the root layout already covers it
    }

    if (route.kind === 'unsupported') {
      skipped.push(relativePath) // real gap, just too complex a route shape to confidently auto-wire
      continue
    }

    const content = readFileSync(filePath, 'utf8')

    if (hasExistingMetadata(content)) {
      skipped.push(relativePath)
      continue
    }

    const patched = buildMetadataPatch(content, route.pathname, route.dynamicParam)
    if (!patched) {
      skipped.push(relativePath)
      continue
    }

    writeFileSync(filePath, patched)
    wired.push(relativePath)
  }

  return { wired, skipped }
}
