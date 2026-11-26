// Local/Vercel-compatible adapter. Shared parsing lives in rssShared.js.
// The Cloudflare Pages Function is functions/api/rss.js.
import { fetchFeed } from './rssShared.js'

export { parseFeed, validateFeedUrl } from './rssShared.js'

// Vercel / Node request handler, also used by the Vite dev middleware.
export default async function handler(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const { status, body } = await fetchFeed(url.searchParams.get('url'))
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

// Legacy Web-standard handler for environments that import this file directly.
export async function onRequest({ request }) {
  const url = new URL(request.url)
  const { status, body } = await fetchFeed(url.searchParams.get('url'))
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
