export interface ImageAlt {
  src: string
  alt: string
  missing: boolean
}

/**
 * A published fix for one page, keyed by pathname in seolful.overrides.json.
 * Committed to git by the Seolful GitHub App — merging the PR is what
 * publishes it; there's no runtime write path.
 */
export interface SeoOverride {
  title?: string
  metaDescription?: string
  structuredData?: object[]
  demoteH1?: boolean
  imageAlts?: ImageAlt[]
}

export type SeoOverridesFile = Record<string, SeoOverride>
