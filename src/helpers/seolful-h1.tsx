import { getPageSeo } from './get-page-seo.js'
import type { ReactNode } from 'react'

interface SeolfulH1Props {
  pathname: string
  children: ReactNode
  className?: string
  isSecondary?: boolean
}

export async function SeolfulH1({
  pathname,
  children,
  className,
  isSecondary = false,
}: SeolfulH1Props) {
  const seo = await getPageSeo(pathname)
  const shouldDemote = isSecondary && seo?.demoteH1

  if (shouldDemote) {
    return <h2 className={className}>{children}</h2>
  }

  return <h1 className={className}>{children}</h1>
}
