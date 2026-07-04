#!/usr/bin/env node
import { createInterface } from 'node:readline/promises'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { performHandshake } from './handshake.js'
import {
  writeEnvLocal,
  updateGitignore,
  scaffoldApiRoute,
  injectIntoLayout,
  scaffoldOverridesFile,
} from './scaffold.js'

function decodeConnectionKey(key: string): { url: string; id: string; tok: string } | null {
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

function getPackageVersion(): string {
  try {
    const pkgPath = new URL('../../package.json', import.meta.url)
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    return pkg.version ?? '1.0.0'
  } catch {
    return '1.0.0'
  }
}

function parseArgs(): Record<string, string> {
  const args = process.argv.slice(2)
  const result: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const [key, ...rest] = args[i].replace(/^--/, '').split('=')
      result[key] = rest.length ? rest.join('=') : (args[++i] ?? '')
    }
  }
  return result
}

export async function init(): Promise<void> {
  const cwd = process.cwd()

  console.log('\n  Seolful Next.js Connector Setup\n')

  if (!isNextJsProject(cwd)) {
    console.error('  ✖ No Next.js project found in the current directory.')
    console.error('  Run this command from the root of your Next.js app.\n')
    process.exit(1)
  }

  const flags = parseArgs()
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  try {
    // Step 1: Get connection key
    const connectionKey =
      flags['key'] ?? (await rl.question('  Connection key (from Seolful dashboard): '))

    if (!connectionKey.trim()) {
      console.error('\n  ✖ A connection key is required.\n')
      process.exit(1)
    }

    const decoded = decodeConnectionKey(connectionKey.trim())
    if (!decoded) {
      console.error('\n  ✖ Invalid connection key. Copy a fresh one from your Seolful dashboard.\n')
      process.exit(1)
    }
    if (!decoded.id || !decoded.tok) {
      console.error('\n  ✖ This connection key is in an old format. Copy a fresh one from your Seolful dashboard.\n')
      process.exit(1)
    }

    // Step 2: Get site URL
    const defaultUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SEOLFUL_SITE_URL ?? 'http://localhost:3000'
    const siteUrl = (
      flags['site-url'] ??
      ((await rl.question(`  Site URL [${defaultUrl}]: `)) || defaultUrl)
    ).replace(/\/$/, '')

    // Step 3: Get site name
    let defaultName = 'My Next.js Site'
    try {
      const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
      if (pkg.name) defaultName = pkg.name
    } catch {
      // ignore
    }
    const siteName = flags['site-name'] ?? ((await rl.question(`  Site name [${defaultName}]: `)) || defaultName)

    rl.close()

    console.log()
    console.log(`  Seolful app:  ${decoded.url}`)
    console.log(`  Site URL:     ${siteUrl}`)
    console.log(`  Site name:    ${siteName}`)
    console.log()

    // Step 4: Credentials — the app mints client_id/token up front and hands
    // them to us via the connection key, so we no longer invent our own.
    const clientId = decoded.id
    const token = decoded.tok

    // Step 5: Handshake
    process.stdout.write('  Connecting to Seolful... ')
    const result = await performHandshake(decoded.url, {
      clientId,
      token,
      siteUrl,
      siteName,
      connectionKey: connectionKey.trim(),
      connectorVersion: getPackageVersion(),
    })
    console.log('✔ Connected')

    // Step 6: Store credentials
    const storageDir = join(cwd, '.seolful')
    if (!existsSync(storageDir)) mkdirSync(storageDir, { recursive: true })

    const tokenHash = await bcrypt.hash(token, 10)
    writeFileSync(
      join(storageDir, 'connection.json'),
      JSON.stringify(
        {
          clientId,
          tokenHash,
          siteUrl,
          connectedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    )

    const configData: Record<string, unknown> = {
      appUrl: decoded.url,
      siteUrl,
      siteName,
    }
    if (result.newConnectionKey) {
      configData.connectionKey = result.newConnectionKey
    }
    writeFileSync(join(storageDir, 'config.json'), JSON.stringify(configData, null, 2))

    // Step 7: Write .env.local
    writeEnvLocal(cwd, 'SEOLFUL_CLIENT_ID', clientId)
    writeEnvLocal(cwd, 'SEOLFUL_TOKEN', token)
    writeEnvLocal(cwd, 'SEOLFUL_APP_URL', decoded.url)
    writeEnvLocal(cwd, 'SEOLFUL_SITE_URL', siteUrl)

    // Step 8: Scaffold API route
    const routePath = scaffoldApiRoute(cwd)

    // Step 9: Inject SEO into root layout
    const layoutModified = injectIntoLayout(cwd)

    // Step 10: Update .gitignore
    updateGitignore(cwd)

    // Step 11: Scaffold the overrides file — this one gets committed, not ignored
    const overridesPath = scaffoldOverridesFile(cwd)

    // Step 12: Success
    console.log()
    console.log('  ✔ .env.local updated')
    console.log('  ✔ .seolful/ created')
    console.log(`  ✔ ${routePath}`)
    if (layoutModified) {
      console.log(`  ✔ ${layoutModified} — auto-injection enabled`)
    }
    console.log('  ✔ .gitignore updated')
    if (overridesPath) {
      console.log(`  ✔ ${overridesPath} created — commit this file, published fixes land here`)
    }
    console.log()
    if (!layoutModified) {
      console.log('  Note: Could not auto-modify your root layout.')
      console.log('  Add this to your layout.tsx generateMetadata:')
      console.log('    import { withSeolfulMetadata } from \'@seolful/nextjs-connector\'')
      console.log()
    }
    console.log('  Seolful is ready — start your dev server and trigger a sync from the dashboard.')
    console.log('  To enable publishing, connect your GitHub repo from the Seolful dashboard:')
    console.log('  fixes arrive as a pull request against seolful.overrides.json, not live writes.')
    console.log()
  } catch (error) {
    rl.close()
    const message = error instanceof Error ? error.message : String(error)
    console.error(`\n  ✖ ${message}\n`)
    process.exit(1)
  }
}

init()
