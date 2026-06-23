import { NextRequest } from 'next/server'
import { getStorage } from '../storage/index.js'

export async function demoteH1Handler(request: NextRequest): Promise<Response> {
  const data = (await request.json()) as Record<string, unknown>

  if (!data.post_id || typeof data.post_id !== 'number') {
    return Response.json({ error: 'post_id is required' }, { status: 422 })
  }

  const storage = getStorage()
  const page = await storage.getPageById(data.post_id)

  if (!page) {
    return Response.json({ error: 'Page not found' }, { status: 404 })
  }

  page.demoteH1 = true
  const { id: _, ...pageWithoutId } = page
  await storage.upsertPage(pageWithoutId)

  try {
    const { revalidatePath } = await import('next/cache')
    const pathname = new URL(page.url).pathname
    revalidatePath(pathname)
  } catch {
    // revalidatePath may not be available outside Next.js runtime
  }

  return Response.json({
    status: 'success',
    fields_updated: ['h1'],
  })
}
