import { NextRequest } from 'next/server'
import { validateToken } from './middleware/validate-token.js'
import { auditDataHandler } from './handlers/audit-data.js'
import { crawlHandler } from './handlers/crawl.js'

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
    default:
      return Response.json({ error: 'Not found' }, { status: 404 })
  }
}
