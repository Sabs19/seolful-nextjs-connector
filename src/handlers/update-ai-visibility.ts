import { NextRequest } from 'next/server'
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getStorage } from '../storage/index.js'

export async function aiVisibilityHandler(request: NextRequest): Promise<Response> {
  const data = (await request.json()) as Record<string, unknown>
  const updated: string[] = []

  if (data.llms_txt_content !== undefined) {
    const publicDir = join(process.cwd(), 'public')
    if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true })
    writeFileSync(join(publicDir, 'llms.txt'), String(data.llms_txt_content))
    updated.push('llms_txt_content')
  }

  if (data.schema_jsonld !== undefined && data.post_id !== undefined) {
    const storage = getStorage()
    const page = await storage.getPageById(Number(data.post_id))

    if (!page) {
      return Response.json({ error: 'Page not found' }, { status: 404 })
    }

    page.structuredData = Array.isArray(data.schema_jsonld) ? data.schema_jsonld as object[] : [data.schema_jsonld as object]
    const { id: _, ...pageWithoutId } = page
    await storage.upsertPage(pageWithoutId)
    updated.push('schema_jsonld')

    try {
      const { revalidatePath } = await import('next/cache')
      const pathname = new URL(page.url).pathname
      revalidatePath(pathname)
    } catch {
      // revalidatePath may not be available outside Next.js runtime
    }
  }

  return Response.json({
    status: 'success',
    fields_updated: updated,
  })
}
