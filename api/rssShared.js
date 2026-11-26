// Pure, portable RSS/Atom helpers. No Node globals, no storage, no user data.

const USER_AGENT = 'Briefr/1.0 (+https://briefr.app) RSS reader'
const MAX_XML_BYTES = 2_000_000
const MAX_ITEMS = 30

export const EDGE_CACHE = 'public, max-age=900, s-maxage=1800, stale-while-revalidate=3600'

export function validateFeedUrl(raw) {
  if (!raw) throw Object.assign(new Error('Missing url parameter'), { status: 400 })
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    throw Object.assign(new Error('Invalid URL'), { status: 400 })
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw Object.assign(new Error('Only http/https URLs are allowed'), { status: 400 })
  }
  const host = parsed.hostname.toLowerCase()
  const blocked =
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.startsWith('[') ||
    host.endsWith('.localhost') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  if (blocked) throw Object.assign(new Error('Private addresses are not allowed'), { status: 400 })
  return parsed
}

function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function clean(value = '') {
  const withoutCdata = value.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1')
  return decodeEntities(withoutCdata.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function tagText(block, tags) {
  for (const tag of tags) {
    const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))
    if (match?.[1]) return clean(match[1])
  }
  return ''
}

function tagLink(block) {
  const href = block.match(/<link[^>]*\bhref\s*=\s*["']([^"']+)["']/i)
  if (href?.[1]) return clean(href[1])
  return tagText(block, ['link'])
}

export function parseFeed(xml) {
  const blocks = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map((match) => match[2])
  return blocks.slice(0, MAX_ITEMS).map((block) => ({
    title: tagText(block, ['title']),
    link: tagLink(block),
    pubDate: tagText(block, ['pubDate', 'published', 'updated', 'dc:date']),
    description: tagText(block, ['description', 'summary', 'content:encoded', 'content']),
  }))
}

export async function fetchFeed(rawUrl) {
  let parsed
  try {
    parsed = validateFeedUrl(rawUrl)
  } catch (error) {
    return { status: error.status, body: { error: error.message, items: [] } }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(parsed, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    })
    if (!response.ok) {
      return { status: 502, body: { error: `Feed request failed (${response.status})`, items: [] } }
    }
    const xml = await response.text()
    if (xml.length > MAX_XML_BYTES) {
      return { status: 413, body: { error: 'Feed too large', items: [] } }
    }
    return { status: 200, body: { items: parseFeed(xml).filter((item) => item.title && item.link) } }
  } catch (error) {
    const message = error.name === 'AbortError' ? 'Feed timed out' : 'Could not fetch feed'
    return { status: 502, body: { error: message, items: [] } }
  } finally {
    clearTimeout(timeout)
  }
}
