// Cloudflare Pages Function → /api/ics
// Fetches one read-only ICS link and returns only the requested local day's events.
// Calendar links can be private, so responses are never cached publicly and
// neither URLs nor event details are ever logged.
import { fetchIcsFeed } from '../../api/icsShared.js'

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  })
}

export const onRequestGet = async ({ request }) => {
  const url = new URL(request.url)
  const params = url.searchParams
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '')
    ? params.get('date')
    : new Date().toISOString().slice(0, 10)
  try {
    const { status, body } = await fetchIcsFeed({
      url: params.get('url'),
      date,
      source: params.get('source') ?? 'Calendar',
      timeZone: params.get('timeZone') || 'UTC',
    })
    return json(body, status)
  } catch {
    return json({ error: 'Calendar link could not be read', items: [] }, 502)
  }
}

export const onRequest = onRequestGet
