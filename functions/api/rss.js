// Cloudflare Pages Function → /api/rss
// Stateless: fetches one RSS/Atom URL, returns JSON, stores nothing.
import { EDGE_CACHE, fetchFeed } from '../../api/rssShared.js'

function json(body, status, cache = false) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cache ? EDGE_CACHE : 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export const onRequest = async ({ request }) => {
  const url = new URL(request.url)
  const { status, body } = await fetchFeed(url.searchParams.get('url'))
  return json(body, status, status === 200)
}

export const onRequestGet = onRequest
