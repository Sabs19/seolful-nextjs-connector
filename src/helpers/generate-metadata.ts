import type { Metadata } from 'next'
import { getPageSeo } from './get-page-seo.js'

export async function withSeolfulMetadata(
  pathname: string,
  base: Metadata,
): Promise<Metadata> {
  const seo = await getPageSeo(pathname)
  if (!seo) return base

  const merged: Metadata = { ...base }

  if (seo.title) {
    merged.title = seo.title
  }

  if (seo.metaDescription) {
    merged.description = seo.metaDescription
  }

  return merged
}
