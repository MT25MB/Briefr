// Local/Vercel-compatible adapter for /api/ics. Shared logic lives in icsShared.js.
import { fetchIcsFeed } from './icsShared.js'

export { parseIcsFeed, validateIcsUrl } from './icsShared.js'

function requestOptions(searchParams) {
  return {
    url: searchParams.get('url'),
    date: /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('date') ?? '')
      ? searchParams.get('date')
      : new Date().toISOString().slice(0, 10),
    source: searchParams.get('source') ?? 'Calendar',
    timeZone: searchParams.get('timeZone') || 'UTC',
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const { status, body } = await fetchIcsFeed(requestOptions(url.searchParams))
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export async function onRequest({ request }) {
  const url = new URL(request.url)
  const { status, body } = await fetchIcsFeed(requestOptions(url.searchParams))
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
