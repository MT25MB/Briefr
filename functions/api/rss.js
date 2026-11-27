// Cloudflare Pages Function → /api/rss
// Stateless: fetches one validated RSS/Atom URL and returns structured JSON.
// Successful, validated feeds are cached at the edge; every error is no-store.
import { EDGE_CACHE, fetchFeed, validateFeedUrl } from '../../api/rssShared.js'

function json(body, status, cache = false) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cache ? EDGE_CACHE : 'no-store',
      'Vary': 'Accept-Encoding',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  })
}

export const onRequest = async ({ request }) => {
  const url = new URL(request.url)
  const raw = url.searchParams.get('url')

  // Validate first so bad or private targets never reach fetch() or the cache.
  try {
    validateFeedUrl(raw)
  } catch (error) {
    return json({ error: error.message ?? 'Invalid feed URL', items: [] }, error.status ?? 400)
  }

  try {
    const { status, body } = await fetchFeed(raw)
    return json(body, status, status === 200)
  } catch {
    // A Worker must always return a clean response, never an unhandled rejection.
    return json({ error: 'Feed could not be read', items: [] }, 502)
  }
}

export const onRequestGet = onRequest
