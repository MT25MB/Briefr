// Pure, portable RSS/Atom helpers. No Node globals, no storage, no user data.

const USER_AGENT = 'Briefr/1.0 (+https://briefr.app) RSS reader'
const MAX_XML_BYTES = 2_000_000
const MAX_ITEMS = 30

// Public feeds are cached at the edge; only validated 200 responses use this.
// Errors and validation failures always stay no-store (set by the function).
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
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  const blocked =
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    // Literal numeric aliases: 2130706433 = 127.0.0.1, 0x7f000001, 0177.0.0.1.
    /^[0-9]+$/.test(host) ||
    /^0[xX][0-9a-fA-F]+$/.test(host) ||
    // Any IPv6 literal is rejected (Workers cannot resolve/verify it here).
    host.includes(':')
  if (blocked) throw Object.assign(new Error('Private addresses are not allowed'), { status: 400 })
  return parsed
}

// fetch() follows redirects by default; re-validate every hop so a public URL
// cannot 302 into loopback or cloud metadata.
async function fetchSafely(target, options, maxHops = 3) {
  let current = target
  for (let hop = 0; hop <= maxHops; hop += 1) {
    const response = await fetch(current, { ...options, redirect: 'manual' })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers?.get?.('location')
      if (!location || hop === maxHops) {
        throw Object.assign(new Error('Too many redirects'), { status: 400 })
      }
      current = validateFeedUrl(new URL(location, current).href)
      continue
    }
    return response
  }
  throw Object.assign(new Error('Too many redirects'), { status: 400 })
}

// Cap the body while streaming so a huge response cannot exhaust memory.
async function readCappedText(response, maxBytes) {
  const declared = Number(response.headers?.get?.('content-length') ?? 0)
  if (declared > maxBytes) return null
  if (!response.body?.getReader) {
    const text = await response.text()
    return text.length <= maxBytes ? text : null
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let text = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) return null
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
  } finally {
    reader.releaseLock?.()
  }
  return text.length <= maxBytes ? text : null
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
    const response = await fetchSafely(parsed, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    })
    if (!response.ok) {
      return { status: 502, body: { error: `Feed request failed (${response.status})`, items: [] } }
    }
    const xml = await readCappedText(response, MAX_XML_BYTES)
    if (xml === null) {
      return { status: 413, body: { error: 'Feed too large', items: [] } }
    }
    return { status: 200, body: { items: parseFeed(xml).filter((item) => item.title && item.link) } }
  } catch (error) {
    if (error.name === 'AbortError') {
      return { status: 408, body: { error: 'Feed timed out', items: [] } }
    }
    return { status: error.status ?? 502, body: { error: error.message ?? 'Could not fetch feed', items: [] } }
  } finally {
    clearTimeout(timeout)
  }
}
