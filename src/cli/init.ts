#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scaffoldOverridesFile, injectIntoLayout, wireUpPages, writeWiringManifest } from './scaffold.js'

function isNextJsProject(cwd: string): boolean {
  const pkgPath = join(cwd, 'package.json')
  if (!existsSync(pkgPath)) return false
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    return Boolean(pkg.dependencies?.next || pkg.devDependencies?.next)
  } catch {
    return false
  }
}

export function init(): void {
  const cwd = process.cwd()

  console.log('\n  Seolful Next.js Connector Setup\n')

  if (!isNextJsProject(cwd)) {
    console.error('  ✖ No Next.js project found in the current directory.')
    console.error('  Run this command from the root of your Next.js app.\n')
    process.exit(1)
  }

  const overridesPath = scaffoldOverridesFile(cwd)
  const layoutModified = injectIntoLayout(cwd)

  console.log()
  if (overridesPath) {
    console.log(`  ✔ ${overridesPath} created — commit this file, published fixes land here`)
  } else {
    console.log('  • seolful.overrides.json already exists — left as-is')
  }
  if (layoutModified) {
    console.log(`  ✔ ${layoutModified} — auto-injection enabled`)
  } else {
    console.log('  Note: could not auto-modify your root layout.')
    console.log('  Add this to your layout.tsx generateMetadata:')
    console.log('    import { withSeolfulMetadata } from \'@seolful/nextjs-connector\'')
  }

  const { wired, skipped, manifestEntries } = wireUpPages(cwd)

  console.log()
  if (wired.length > 0) {
    console.log(`  ✔ ${wired.length} page${wired.length === 1 ? '' : 's'} wired up automatically:`)
    for (const path of wired) console.log(`      ${path}`)
  }
  if (skipped.length > 0) {
    console.log(`  ${skipped.length} page${skipped.length === 1 ? '' : 's'} need manual setup (already have their own metadata, or a route shape this can't auto-wire):`)
    for (const path of skipped) console.log(`      ${path}`)
    console.log('  See the README for how to add withSeolfulMetadata/SeolfulSchema/SeolfulH1/SeolfulImage to these.')
  }
  if (wired.length === 0 && skipped.length === 0) {
    console.log('  No additional pages found under app/ to wire up.')
  }

  // Reported to Seolful once the GitHub repo is connected — lets the
  // dashboard flag a page needing a developer immediately, instead of only
  // after a published fix fails to show up live.
  const manifestPath = writeWiringManifest(cwd, manifestEntries)
  console.log()
  console.log(`  ✔ ${manifestPath} written — commit this file too, so Seolful knows which pages need manual setup as soon as your repo is connected`)

  console.log()
  console.log('  No connection key needed — add this site from your Seolful dashboard by URL.')
  console.log('  To enable publishing, connect your GitHub repo from the site\'s settings page:')
  console.log('  fixes arrive as a pull request against seolful.overrides.json, not a live write.')
  console.log()
}

init()
