import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const store = new Map()
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
}
globalThis.window = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
}

const { EDGE_CACHE } = await import('../api/rssShared.js')
assert.equal(EDGE_CACHE, 'public, max-age=900, s-maxage=1800, stale-while-revalidate=3600')

const { onRequestGet: rssGet } = await import('../functions/api/rss.js')
const rssRequest = (url) => new Request(`https://briefr.app/api/rss?url=${encodeURIComponent(url)}`)

let response = await rssGet({ request: new Request('https://briefr.app/api/rss') })
assert.equal(response.status, 400)
assert.equal(response.headers.get('cache-control'), 'no-store')
assert.match((await response.json()).error, /Missing/)

response = await rssGet({ request: rssRequest('http://169.254.169.254/latest/meta-data/') })
assert.equal(response.status, 400)
assert.equal(response.headers.get('cache-control'), 'no-store')

globalThis.fetch = async () => {
  throw Object.assign(new Error('aborted'), { name: 'AbortError' })
}
response = await rssGet({ request: rssRequest('https://slow.example/feed.xml') })
assert.equal(response.status, 408)
assert.equal(response.headers.get('cache-control'), 'no-store')
assert.match((await response.json()).error, /timed out/i)

globalThis.fetch = async () => ({ status: 503, ok: false, headers: new Headers(), text: async () => '' })
response = await rssGet({ request: rssRequest('https://down.example/feed.xml') })
assert.equal(response.status, 502)
assert.equal(response.headers.get('cache-control'), 'no-store')

globalThis.fetch = async () => ({
  status: 200,
  ok: true,
  headers: new Headers(),
  text: async () => '<rss><item><title>Story</title><link>https://example.com/a</link></item></rss>',
})
response = await rssGet({ request: rssRequest('https://fresh.example/feed.xml') })
assert.equal(response.status, 200)
assert.equal(response.headers.get('cache-control'), EDGE_CACHE)
assert.equal(response.headers.get('vary'), 'Accept-Encoding')
assert.equal((await response.json()).items.length, 1)

// ICS stays private even when successful.
const { onRequestGet: icsGet } = await import('../functions/api/ics.js')
const { validateIcsUrl } = await import('../api/icsShared.js')
assert.throws(() => validateIcsUrl('http://127.0.0.1/cal.ics'), /https/)
assert.throws(() => validateIcsUrl('https://169.254.169.254/cal.ics'), /Private/)
globalThis.fetch = async () => ({
  status: 200,
  ok: true,
  headers: new Headers(),
  text: async () =>
    'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:1\r\nDTSTART:20261127T090000Z\r\nDTEND:20261127T093000Z\r\nSUMMARY:Standup\r\nEND:VEVENT\r\nEND:VCALENDAR',
})
response = await icsGet({
  request: new Request('https://briefr.app/api/ics?url=https://cal.example/private.ics&date=2026-11-27'),
})
assert.equal(response.status, 200)
assert.equal(response.headers.get('cache-control'), 'no-store')
assert.equal(response.headers.get('referrer-policy'), 'no-referrer')

// Client cache and in-flight dedupe.
const { dedupeRequest, getCachedResponse, setCachedResponse, clearResponseCache } =
  await import('../src/lib/storage.js')
let taskCalls = 0
const task = () => new Promise((resolve) => {
  taskCalls += 1
  setTimeout(() => resolve('done'), 15)
})
const shared = await Promise.all([dedupeRequest('test', task), dedupeRequest('test', task)])
assert.deepEqual(shared, ['done', 'done'])
assert.equal(taskCalls, 1)
setCachedResponse('cached', ['value'], 60_000)
assert.deepEqual(getCachedResponse('cached'), ['value'])
clearResponseCache()
assert.equal(getCachedResponse('cached'), null)

// RSS adapter dedupes and reuses the short client cache.
const { fetchNewsDigest } = await import('../src/lib/rssService.js')
let rssCalls = 0
globalThis.fetch = async () => {
  rssCalls += 1
  return {
    ok: true,
    status: 200,
    json: async () => ({
      items: [{ title: 'Story', link: 'https://example.com/a', pubDate: 'Fri, 27 Nov 2026 08:00:00 GMT' }],
    }),
  }
}
const feedUrl = 'https://custom.example/feed.xml'
const [first, second] = await Promise.all([
  fetchNewsDigest({ feeds: [feedUrl] }),
  fetchNewsDigest({ feeds: [feedUrl] }),
])
assert.equal(first.items.length, 1)
assert.equal(second.items.length, 1)
assert.equal(rssCalls, 1)
await fetchNewsDigest({ feeds: [feedUrl] })
assert.equal(rssCalls, 1)

// Calendar adapters dedupe simultaneous requests.
const { fetchGoogleEvents } = await import('../src/lib/calendarService.js')
let googleCalls = 0
globalThis.fetch = async () => {
  googleCalls += 1
  return { ok: true, status: 200, json: async () => ({ items: [] }) }
}
await Promise.all([
  fetchGoogleEvents({ token: 'token-123', date: '2026-11-27' }),
  fetchGoogleEvents({ token: 'token-123', date: '2026-11-27' }),
])
assert.equal(googleCalls, 1)

// Quota guardrails and calm status surface.
const { quotaSnapshot, applyRateLimit, isDailyQuota } = await import('../src/lib/llmRotator.js')
const now = Date.now()
const key = {
  id: 'k14', provider: 'groq', apiKey: 'x', label: 'K14', cooldownUntil: null,
  dailyExhausted: false, lastError: null, baseUrl: 'https://api.groq.com/openai/v1',
}
const snapshot = quotaSnapshot(
  [
    key,
    { ...key, id: 'rest', cooldownUntil: now + 30_000 },
    { ...key, id: 'daily', dailyExhausted: true },
    { ...key, id: 'bad', lastError: 'Invalid API key' },
  ],
  now,
)
assert.deepEqual(
  [snapshot.ready, snapshot.cooldown, snapshot.daily, snapshot.invalid],
  [1, 1, 1, 1],
)
assert.equal(snapshot.exhausted, false)
assert.equal(quotaSnapshot([{ ...key, dailyExhausted: true }], now).exhausted, true)
const limited = applyRateLimit([key], key.id, { retryAfterSeconds: 120, now })
assert.ok(limited[0].cooldownUntil - now >= 119_000)
assert.equal(
  isDailyQuota({ text: 'Quota exceeded for the day', headers: new Headers() }),
  true,
)
assert.equal(isDailyQuota({ text: 'rate_limit_exceeded', headers: new Headers() }), false)

const app = read('src/App.jsx')
assert.match(app, /StatusBanner/)
assert.match(app, /Every key is resting or used up for today/)
assert.match(app, /quotaSnapshot\(keys, now\)/)
assert.doesNotMatch(app, /RotationStatusBanner/)
const banner = read('src/components/StatusBanner.jsx')
assert.match(banner, /role="status"/)
assert.match(banner, /non-blocking/)

console.log('Milestone 14 verified: edge cache, structured errors, private ICS, dedupe, quota guardrails, calm banner.')
