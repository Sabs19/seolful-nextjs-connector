#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

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

const root = findProjectRoot()
if (root && isNextJsProject(root)) {
  scaffoldRoute(root)
}
