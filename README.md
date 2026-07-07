# @seolful/nextjs-connector

Runtime helpers that apply Seolful's published SEO fixes to a Next.js site. This package does **not** crawl your site and does **not** write anything at request time — both of those happen elsewhere:

- **Auditing** — Seolful crawls your site's public URLs directly from its own servers, the same way a search engine would. Nothing runs on your site to make this work.
- **Fixes** — when you publish a fix from the Seolful dashboard, it opens a pull request against your repo that edits `seolful.overrides.json`. You review and merge it like any other PR; the fix goes live on your next deploy.

This package's only job is what happens *after* that: reading `seolful.overrides.json` (bundled into your deployment because it's a committed file, not written at runtime — required on Vercel's read-only filesystem) and applying it to what actually gets rendered.

## Install

```bash
npx @seolful/nextjs-connector init
```

Run once, from your project root. This:

- creates `seolful.overrides.json` (empty `{}`) if it doesn't exist yet — **commit this file**, it's what the Seolful GitHub App opens pull requests against
- tries to auto-wire `withSeolfulMetadata` into your root layout's metadata
- scans `app/` for other pages with no metadata setup at all (no `generateMetadata`, no static `metadata` export) and wires those up too, deriving each page's route straight from its own file location

A page that already has its own `generateMetadata` (or a re-exported one), a client component, or a route this can't confidently pattern-match (catch-all segments, more than one dynamic segment) is left untouched — `init` prints exactly which pages fall into that bucket so you know what needs the manual setup below, rather than finding out later when a published fix doesn't show up.

Commit the result and deploy.

## Update

```bash
npm install @seolful/nextjs-connector@latest
```

## What it exports

| Export | Applies |
| --- | --- |
| `withSeolfulMetadata(pathname, baseMetadata)` | Title / meta description overrides, merged into a page's `generateMetadata` result |
| `<SeolfulSchema pathname="..." />` | Structured data (JSON-LD) fixes, rendered as `<script type="application/ld+json">` |
| `<SeolfulH1 pathname="..." isSecondary>` | Demotes a duplicate H1 to `<h2>` when a "Duplicate H1 Tag" fix has been published |
| `<SeolfulImage seolfulAlts={...} src={...} alt={...} />` | Swaps in the published alt text for a specific image, by `src` |

Every helper reads the same `seolful.overrides.json`, keyed by URL path — none of them talk to Seolful's servers, so there's no API call, no auth, and no added latency beyond a local file read.

### Example

```tsx
// app/products/[slug]/page.tsx
import { withSeolfulMetadata, SeolfulSchema, SeolfulH1 } from '@seolful/nextjs-connector'

export async function generateMetadata({ params }) {
  const { slug } = await params
  return withSeolfulMetadata(`/products/${slug}`, {
    title: 'Default title',
    description: 'Default description',
  })
}

export default async function ProductPage({ params }) {
  const { slug } = await params
  return (
    <>
      <SeolfulH1 pathname={`/products/${slug}`} isSecondary>Related products</SeolfulH1>
      <SeolfulSchema pathname={`/products/${slug}`} />
    </>
  )
}
```

`SeolfulImage` and `SeolfulH1` are opt-in — you have to actually use them in place of `next/image` and a raw `<h1>` for their fixes to take effect. `withSeolfulMetadata` and `SeolfulSchema` don't require any markup changes beyond wiring them in once, per route.
