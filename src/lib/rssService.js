// Feed presets + parallel fetching through the stateless /api/rss endpoint.
const googleNews = (query) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:1d`)}&hl=en-US&gl=US&ceid=US:en`

export const RSS_PACKS = [
  {
    id: 'Local',
    name: 'Local News',
    feeds: [{ label: 'Google News · Local', url: googleNews('local news') }],
  },
  {
    id: 'Tech & AI',
    name: 'Tech & AI',
    feeds: [
      { label: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
      { label: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
      { label: 'Google News · AI', url: googleNews('artificial intelligence') },
    ],
  },
  {
    id: 'World',
    name: 'World',
    feeds: [
      { label: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
      { label: 'Google News · World', url: googleNews('world news') },
    ],
  },
  {
    id: 'Finance',
    name: 'Finance',
    feeds: [
      { label: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
      { label: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
    ],
  },
]

export function localFeedUrl(location = '') {
  return googleNews(`${String(location).trim() || 'local'} local news`)
}

export function stripHtml(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function relativeTime(pubDate) {
  const time = Date.parse(pubDate)
  if (Number.isNaN(time)) return 'recent'
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

async function fetchOneFeed(feed) {
  const response = await fetch(`/api/rss?url=${encodeURIComponent(feed.url)}`)
  if (!response.ok) throw new Error(`${feed.label} (${response.status})`)
  const data = await response.json()
  if (data.error) throw new Error(`${feed.label}: ${data.error}`)
  return (data.items ?? []).map((item) => ({
    title: stripHtml(item.title),
    link: item.link,
    pubDate: item.pubDate,
    description: stripHtml(item.description),
    source: feed.label,
    category: feed.category,
    time: relativeTime(item.pubDate),
  }))
}

export async function fetchNewsDigest({ topics = [], feeds = [], location = '', limit = 28 }) {
  const selected = RSS_PACKS.filter((pack) => topics.includes(pack.id))
  const targets = []

  selected.forEach((pack) => {
    pack.feeds.forEach((feed) => {
      targets.push({ ...feed, category: pack.name })
    })
  })
  if (topics.includes('Local')) {
    targets.push({ label: `Local · ${location || 'nearby'}`, url: localFeedUrl(location), category: 'Local News' })
  }
  feeds.forEach((url) => {
    if (targets.some((target) => target.url === url)) return
    let host = url
    try {
      host = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      // Keep the raw value as a label if it is not parseable.
    }
    targets.push({ label: host, url, category: 'Custom feed' })
  })

  const results = await Promise.allSettled(targets.map(fetchOneFeed))
  const errors = results
    .filter((entry) => entry.status === 'rejected')
    .map((entry) => entry.reason?.message ?? 'Feed failed')
  const items = results
    .filter((entry) => entry.status === 'fulfilled')
    .flatMap((entry) => entry.value)
    .sort((a, b) => Date.parse(b.pubDate || 0) - Date.parse(a.pubDate || 0))
    .slice(0, limit)

  return { items, errors, sourceCount: targets.length - errors.length }
}
