import { getPageSeo } from './get-page-seo.js'

interface SeolfulSchemaProps {
  pathname: string
}

export async function SeolfulSchema({ pathname }: SeolfulSchemaProps) {
  const seo = await getPageSeo(pathname)
  const schemas = seo?.structuredData ?? []

  if (schemas.length === 0) return null

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  )
}
