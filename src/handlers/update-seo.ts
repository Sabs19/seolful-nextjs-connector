import { NextRequest } from 'next/server'
import { getStorage } from '../storage/index.js'

const LABEL_PREFIXES = [
  'Meta Description:', 'Meta description:',
  'Title Tag:', 'Title tag:', 'Title:',
  'New Title:', 'New Meta Description:',
  'Revised Title:', 'Revised Meta Description:',
  'Updated Title:', 'Updated Meta Description:',
  'H1:', 'H1 Heading:', 'Alt Text:', 'Alt text:',
]

function stripLabelPrefix(value: string): string {
  for (const prefix of LABEL_PREFIXES) {
    if (value.startsWith(prefix)) {
      return value.slice(prefix.length).trim()
    }
  }
  return value
}

export async function updateSeoHandler(request: NextRequest): Promise<Response> {
  const data = (await request.json()) as Record<string, unknown>

  if (!data.post_id || typeof data.post_id !== 'number') {
    return Response.json({ error: 'post_id is required' }, { status: 422 })
  }

  const storage = getStorage()
  const page = await storage.getPageById(data.post_id)

  if (!page) {
    return Response.json({ error: 'Page not found' }, { status: 404 })
  }

  const updated: string[] = []

  if (data.meta_title !== undefined) {
    page.title = stripLabelPrefix(String(data.meta_title))
    updated.push('meta_title')
  }

  if (data.meta_description !== undefined) {
    page.metaDescription = stripLabelPrefix(String(data.meta_description))
    updated.push('meta_description')
  }

  if (data.image_src !== undefined && data.image_alt !== undefined) {
    const alts = page.imageAlts ?? []
    for (const img of alts) {
      if (img.src === data.image_src) {
        img.alt = String(data.image_alt)
        img.missing = false
        break
      }
    }
    page.imageAlts = alts
    updated.push('image_alt')
  }

  const { id: _, ...pageWithoutId } = page
  await storage.upsertPage(pageWithoutId)

  // Trigger ISR revalidation
  try {
    const { revalidatePath } = await import('next/cache')
    const pathname = new URL(page.url).pathname
    revalidatePath(pathname)
  } catch {
    // revalidatePath may not be available outside Next.js runtime
  }

  return Response.json({
    status: 'success',
    fields_updated: updated,
  })
}
