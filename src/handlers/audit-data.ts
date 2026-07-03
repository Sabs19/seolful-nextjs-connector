import { NextRequest } from 'next/server'
import { getStorage } from '../storage/index.js'
import { getPageRole, getContentType } from '../types.js'

const PER_PAGE = 75

export async function auditDataHandler(request: NextRequest): Promise<Response> {
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))

  const storage = getStorage()
  const { data, total } = await storage.getAllPages(page, PER_PAGE)
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE))

  const items = data.map((p) => {
    const missingAltImages = (p.imageAlts ?? []).filter((img) => img.missing)

    return {
      url: p.url,
      post_id: p.id,
      title: p.title,
      meta_description: p.metaDescription,
      type: getContentType(p),
      page_role: getPageRole(p),
      h1_in_content: p.h1Count > 1,
      h1_text: p.h1Count > 1 ? p.h1Secondary : null,
      word_count: p.wordCount,
      images_missing_alt: missingAltImages.map((img) => ({ src: img.src })),
      internal_links: p.internalLinkCount,
      structured_data: p.structuredData ?? [],
      is_noindexed: p.noindex,
      canonical_url: p.canonicalUrl,
      page_builder: null,
    }
  })

  let connectorVersion: string | null = null
  try {
    const pkg = await import('../../package.json', { with: { type: 'json' } })
    connectorVersion = pkg.default.version
  } catch {
    // ignore
  }

  return Response.json({
    data: items,
    current_page: page,
    last_page: lastPage,
    per_page: PER_PAGE,
    total,
    connector_version: connectorVersion,
  })
}
