// Cloudflare Pages Function → /api/ics
// Fetches one read-only ICS link and returns only today's normalized events.
// No event details are logged or stored.
import { fetchIcsFeed } from '../../api/icsShared.js'

const EDGE_CACHE = 'public, max-age=900, s-maxage=1800, stale-while-revalidate=3600'

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
  const params = url.searchParams
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '')
    ? params.get('date')
    : new Date().toISOString().slice(0, 10)
  const { status, body } = await fetchIcsFeed({
    url: params.get('url'),
    date,
    source: params.get('source') ?? 'Calendar',
    timeZone: params.get('timeZone') || 'UTC',
  })
  return json(body, status, status === 200)
}

export const onRequestGet = onRequest
