import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

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
