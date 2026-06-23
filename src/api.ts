import { NextRequest } from 'next/server'
import { validateToken } from './middleware/validate-token.js'
import { auditDataHandler } from './handlers/audit-data.js'
import { crawlHandler } from './handlers/crawl.js'
import { updateSeoHandler } from './handlers/update-seo.js'
import { aiVisibilityHandler } from './handlers/update-ai-visibility.js'
import { demoteH1Handler } from './handlers/demote-h1.js'

function resolvePath(request: NextRequest): string {
  const url = new URL(request.url)
  const match = url.pathname.match(/\/api\/seolful\/v1\/(.+)/)
  return match?.[1] ?? ''
}

async function withAuth(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<Response>,
): Promise<Response> {
  const result = await validateToken(request.headers)
  if (!result.valid) {
    return Response.json({ error: result.error }, { status: result.status })
  }
  return handler(request)
}

export async function GET(request: NextRequest): Promise<Response> {
  const path = resolvePath(request)

  switch (path) {
    case 'audit-data':
      return withAuth(request, auditDataHandler)
    default:
      return Response.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const path = resolvePath(request)

  switch (path) {
    case 'crawl':
      return withAuth(request, crawlHandler)
    case 'update-seo':
      return withAuth(request, updateSeoHandler)
    case 'update-ai-visibility':
      return withAuth(request, aiVisibilityHandler)
    case 'demote-h1':
      return withAuth(request, demoteH1Handler)
    default:
      return Response.json({ error: 'Not found' }, { status: 404 })
  }
}
