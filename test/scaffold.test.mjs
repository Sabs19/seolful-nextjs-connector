import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { wireUpPages } from '../dist/cli/scaffold.js'

// wireUpPages derives each page's route from its own file location and
// mutates matching files in place — every test gets its own throwaway
// project directory so runs can't interfere with each other.
function withFixture(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'seolful-connector-test-'))
  try {
    for (const [relativePath, content] of Object.entries(files)) {
      const full = join(root, relativePath)
      mkdirSync(join(full, '..'), { recursive: true })
      writeFileSync(full, content)
    }
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const NO_METADATA_PAGE = `export default function Page() {\n  return null\n}\n`
const HAS_GENERATE_METADATA_PAGE = `export async function generateMetadata() {\n  return { title: 'Custom' }\n}\n\nexport default function Page() {\n  return null\n}\n`
const RE_EXPORTED_METADATA_PAGE = `export { metadata } from './seo'\n\nexport default function Page() {\n  return null\n}\n`
const USE_CLIENT_PAGE = `'use client'\n\nexport default function Page() {\n  return null\n}\n`
const NO_DEFAULT_FUNCTION_PAGE = `const Page = () => null\nexport default Page\n`

test('wires a dynamic route with no existing metadata', () => {
  withFixture(
    { 'src/app/(public)/products/[slug]/page.tsx': NO_METADATA_PAGE },
    (root) => {
      const { wired, skipped } = wireUpPages(root)

      assert.deepEqual(wired, ['src/app/(public)/products/[slug]/page.tsx'])
      assert.deepEqual(skipped, [])

      const patched = readFileSync(join(root, 'src/app/(public)/products/[slug]/page.tsx'), 'utf8')
      assert.match(patched, /import \{ withSeolfulMetadata \} from '@seolful\/nextjs-connector'/)
      assert.match(patched, /export async function generateMetadata\(\{ params \}: \{ params: Promise<\{ slug: string \}> \}\)/)
      assert.match(patched, /const \{ slug \} = await params/)
      assert.match(patched, /withSeolfulMetadata\(`\/products\/\$\{slug\}`, \{\}\)/)
      assert.match(patched, /export default function Page\(\)/) // original code preserved
    },
  )
})

test('wires a static route with no existing metadata', () => {
  withFixture({ 'src/app/(public)/about/page.tsx': NO_METADATA_PAGE }, (root) => {
    const { wired, skipped } = wireUpPages(root)

    assert.deepEqual(wired, ['src/app/(public)/about/page.tsx'])
    assert.deepEqual(skipped, [])

    const patched = readFileSync(join(root, 'src/app/(public)/about/page.tsx'), 'utf8')
    assert.match(patched, /export async function generateMetadata\(\) \{/)
    assert.match(patched, /withSeolfulMetadata\('\/about', \{\}\)/)
  })
})

test('skips a page that already has generateMetadata', () => {
  withFixture({ 'src/app/(public)/blog/[slug]/page.tsx': HAS_GENERATE_METADATA_PAGE }, (root) => {
    const { wired, skipped } = wireUpPages(root)

    assert.deepEqual(wired, [])
    assert.deepEqual(skipped, ['src/app/(public)/blog/[slug]/page.tsx'])
  })
})

test('skips a page that re-exports metadata from another file', () => {
  withFixture({ 'src/app/(public)/blog/[slug]/page.tsx': RE_EXPORTED_METADATA_PAGE }, (root) => {
    const { wired, skipped } = wireUpPages(root)

    assert.deepEqual(wired, [])
    assert.deepEqual(skipped, ['src/app/(public)/blog/[slug]/page.tsx'])
  })
})

test('skips a client component', () => {
  withFixture({ 'src/app/(public)/about/page.tsx': USE_CLIENT_PAGE }, (root) => {
    const { wired, skipped } = wireUpPages(root)

    assert.deepEqual(wired, [])
    assert.deepEqual(skipped, ['src/app/(public)/about/page.tsx'])
  })
})

test('skips a page whose default export is not a recognizable function', () => {
  withFixture({ 'src/app/(public)/pricing/page.tsx': NO_DEFAULT_FUNCTION_PAGE }, (root) => {
    const { wired, skipped } = wireUpPages(root)

    assert.deepEqual(wired, [])
    assert.deepEqual(skipped, ['src/app/(public)/pricing/page.tsx'])
  })
})

test('reports a catch-all route as needing manual setup, rather than silently ignoring it', () => {
  withFixture({ 'src/app/(public)/shop/[...filters]/page.tsx': NO_METADATA_PAGE }, (root) => {
    const { wired, skipped } = wireUpPages(root)

    assert.deepEqual(wired, [])
    assert.deepEqual(skipped, ['src/app/(public)/shop/[...filters]/page.tsx'])
  })
})

test('reports an optional catch-all route as needing manual setup', () => {
  withFixture({ 'src/app/(public)/shop/[[...filters]]/page.tsx': NO_METADATA_PAGE }, (root) => {
    const { wired, skipped } = wireUpPages(root)

    assert.deepEqual(wired, [])
    assert.deepEqual(skipped, ['src/app/(public)/shop/[[...filters]]/page.tsx'])
  })
})

test('reports a route with more than one dynamic segment as needing manual setup', () => {
  withFixture({ 'src/app/(public)/products/[category]/[slug]/page.tsx': NO_METADATA_PAGE }, (root) => {
    const { wired, skipped } = wireUpPages(root)

    assert.deepEqual(wired, [])
    assert.deepEqual(skipped, ['src/app/(public)/products/[category]/[slug]/page.tsx'])
  })
})

test('excludes admin and protected routes entirely, without reporting them', () => {
  withFixture({ 'src/app/admin/(protected)/products/[id]/page.tsx': NO_METADATA_PAGE }, (root) => {
    const { wired, skipped } = wireUpPages(root)

    assert.deepEqual(wired, [])
    assert.deepEqual(skipped, [])
  })
})

test('excludes the homepage entirely — the root layout already covers it', () => {
  withFixture({ 'src/app/page.tsx': NO_METADATA_PAGE }, (root) => {
    const { wired, skipped } = wireUpPages(root)

    assert.deepEqual(wired, [])
    assert.deepEqual(skipped, [])
  })
})

test('excludes parallel route slots (@modal) entirely — not a real URL segment', () => {
  withFixture({ 'src/app/@modal/photo/[id]/page.tsx': NO_METADATA_PAGE }, (root) => {
    const { wired, skipped } = wireUpPages(root)

    assert.deepEqual(wired, [])
    assert.deepEqual(skipped, [])
  })
})

test('reports an intercepting route as needing manual setup, rather than deriving a garbled path', () => {
  withFixture({ 'src/app/feed/(.)photo/[id]/page.tsx': NO_METADATA_PAGE }, (root) => {
    const { wired, skipped } = wireUpPages(root)

    assert.deepEqual(wired, [])
    assert.deepEqual(skipped, ['src/app/feed/(.)photo/[id]/page.tsx'])
  })
})

test('is idempotent — running twice does not re-wire an already-wired page', () => {
  withFixture({ 'src/app/(public)/about/page.tsx': NO_METADATA_PAGE }, (root) => {
    const first = wireUpPages(root)
    assert.deepEqual(first.wired, ['src/app/(public)/about/page.tsx'])

    const second = wireUpPages(root)
    assert.deepEqual(second.wired, [])
    assert.deepEqual(second.skipped, ['src/app/(public)/about/page.tsx'])
  })
})

test('mixed project: wires the safe pages and reports exactly the ones that need manual setup', () => {
  withFixture(
    {
      'src/app/page.tsx': NO_METADATA_PAGE,
      'src/app/(public)/about/page.tsx': NO_METADATA_PAGE,
      'src/app/(public)/products/[slug]/page.tsx': NO_METADATA_PAGE,
      'src/app/(public)/blog/[slug]/page.tsx': HAS_GENERATE_METADATA_PAGE,
      'src/app/(public)/shop/[[...filters]]/page.tsx': NO_METADATA_PAGE,
      'src/app/admin/(protected)/products/[id]/page.tsx': NO_METADATA_PAGE,
      'src/app/@modal/photo/[id]/page.tsx': NO_METADATA_PAGE,
    },
    (root) => {
      const { wired, skipped } = wireUpPages(root)

      assert.deepEqual(
        wired.sort(),
        ['src/app/(public)/about/page.tsx', 'src/app/(public)/products/[slug]/page.tsx'].sort(),
      )
      assert.deepEqual(
        skipped.sort(),
        ['src/app/(public)/blog/[slug]/page.tsx', 'src/app/(public)/shop/[[...filters]]/page.tsx'].sort(),
      )
    },
  )
})
