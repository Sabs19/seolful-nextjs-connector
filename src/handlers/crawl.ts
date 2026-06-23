import { crawlSite } from '../crawler/crawl-service.js'

export async function crawlHandler(): Promise<Response> {
  const result = await crawlSite()

  return Response.json({
    status: 'success',
    crawled: result.crawled,
    failed: result.failed,
    total: result.total,
  })
}
