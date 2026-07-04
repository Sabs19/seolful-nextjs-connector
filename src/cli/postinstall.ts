#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scaffoldInstrumentation } from './scaffold.js'

function findProjectRoot(): string | null {
  // npm/yarn/pnpm set INIT_CWD to the directory where the install was run
  const initCwd = process.env.INIT_CWD
  if (initCwd && existsSync(join(initCwd, 'package.json'))) {
    return initCwd
  }
  return null
}

function isNextJsProject(cwd: string): boolean {
  const pkgPath = join(cwd, 'package.json')
  if (!existsSync(pkgPath)) return false
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    return !!deps['next']
  } catch {
    return false
  }
}

function scaffoldRoute(cwd: string): void {
  const routeContent = `export { GET, POST } from '@seolful/nextjs-connector/api'\n`

  const useSrc = existsSync(join(cwd, 'src', 'app'))
  const appDir = useSrc ? join(cwd, 'src', 'app') : join(cwd, 'app')

  if (!existsSync(appDir)) return

  const routeDir = join(appDir, 'api', 'seolful', 'v1', '[...path]')
  const routePath = join(routeDir, 'route.ts')

  if (existsSync(routePath)) return

  mkdirSync(routeDir, { recursive: true })
  writeFileSync(routePath, routeContent)

  const relative = useSrc
    ? 'src/app/api/seolful/v1/[...path]/route.ts'
    : 'app/api/seolful/v1/[...path]/route.ts'

  console.log(`\n  seolful: created ${relative}\n`)
}

function warnIfNoRedisOnVercel(): void {
  const onVercel = process.env.VERCEL === '1'
  const hasRedis = Boolean(
    (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL) &&
      (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN)
  )

  if (onVercel && !hasRedis) {
    console.log('\n  seolful: no Redis detected — crawled page data (used for audits) will be')
    console.log('  seolful: stored in /tmp, which Vercel does not guarantee to persist between')
    console.log('  seolful: requests. This only affects audit freshness, not published fixes —')
    console.log('  seolful: those are committed to seolful.overrides.json via a GitHub PR.')
    console.log('  seolful: add a Redis integration (Vercel Marketplace → Upstash Redis) for reliable audits.\n')
  }
}

const root = findProjectRoot()
if (root && isNextJsProject(root)) {
  scaffoldRoute(root)

  const instrumentationPath = scaffoldInstrumentation(root)
  if (instrumentationPath) {
    console.log(`  seolful: created ${instrumentationPath}`)
    console.log('  seolful: on Next.js 13.4–14, add `experimental: { instrumentationHook: true }` to next.config.js\n')
  }
}

warnIfNoRedisOnVercel()
