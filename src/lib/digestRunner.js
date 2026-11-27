// One-call morning run: free weather + RSS, optional LLM synthesis, same-day cache.
import { digest, mockWeather } from './mockDigest.js'
import { loadCalendars, loadKeys, digestCacheKey, newsCacheKey, todayKey } from './storage.js'
import { getTodaysEvents } from './calendarService.js'
import { runWithRotation } from './llmRotator.js'
import { fetchHourlyWeather, geocodeLocation, normalizeForecast, summarizeWeather } from './weatherService.js'
import { fetchNewsDigest } from './rssService.js'
import { buildFallbackWardrobe, buildNewsRankingPrompt, buildWeatherOutfitPrompt } from './prompts.js'

const SYSTEM_PROMPT =
  'You are Briefr, a calm morning briefing assistant. Return strict JSON only, with no markdown or commentary.'

const validWardrobe = (data) =>
  Boolean(data && typeof data.headline === 'string' && Array.isArray(data.wardrobeTimeline))
const validNews = (data) =>
  Boolean(data && Array.isArray(data.local) && Array.isArray(data.important))

export const MOCK_NEWS_ITEMS = [
  ...digest.news.raw.local.map((item) => ({ ...item, category: 'Local News' })),
  ...digest.news.raw.top.map((item) => ({ ...item, category: 'World' })),
].map((item) => ({
  title: item.title,
  link: 'https://example.com',
  pubDate: new Date().toISOString(),
  description: '',
  source: item.source,
  category: item.category,
  time: `${item.time} ago`,
}))

async function loadWeather(location) {
  try {
    const places = await geocodeLocation(location || digest.location)
    if (!places.length) throw new Error('No matching location found')
    const forecast = await fetchHourlyWeather(places[0].lat, places[0].lon)
    return { weather: normalizeForecast(forecast, places[0]), source: 'live', error: null, offline: false }
  } catch (error) {
    return { weather: mockWeather, source: 'mock', error: error.message, offline: true }
  }
}

async function loadNews(prefs) {
  try {
    const result = await fetchNewsDigest({
      topics: prefs.topics,
      feeds: prefs.feeds,
      location: prefs.location,
      politicalLens: prefs.politicalLens,
      coverageMode: prefs.coverageMode,
    })
    return { items: result.items, errors: result.errors, sourceCount: result.sourceCount, offline: false }
  } catch {
    // Kept for the raw/offline UI only, never sent to the LLM as real news.
    return { items: MOCK_NEWS_ITEMS, errors: ['Using offline preview'], sourceCount: 0, offline: true }
  }
}

// Coordinates the whole morning run: calendars, weather, feeds, and synthesis.
// Every section degrades independently; one failed source cannot break the page.
export async function runMorningDigest({
  prefs,
  keys = [],
  forceRefresh = false,
  connections,
  date = todayKey(),
}) {
  const activeConnections = connections ?? loadCalendars()
  const connected = Boolean(
    activeConnections.google?.token ||
      (activeConnections.notion?.token && activeConnections.notion?.databaseId) ||
      activeConnections.ics?.length ||
      (activeConnections.caldav?.proxyUrl && activeConnections.caldav?.calendarUrl),
  )
  const [calendar, forecast, feed] = await Promise.all([
    getTodaysEvents(activeConnections, date).catch((error) => ({ events: [], errors: [error.message] })),
    loadWeather(prefs.location),
    loadNews(prefs),
  ])
  const schedule = calendar.events ?? []

  const preferences = {
    sensitivity: prefs.sensitivity,
    commute: prefs.commute,
    tone: prefs.tone,
  }
  let wardrobe = buildFallbackWardrobe(forecast.weather, preferences, schedule)
  let wardrobeMeta = { source: 'deterministic', loading: false }
  let newsDigest = null
  let newsSource = 'raw'
  let newsRankMeta = null
  let activeKeys = keys

  if (activeKeys.length && !forecast.offline) {
    let outfitRun = null
    try {
      outfitRun = await runWithRotation({
        keys: activeKeys,
        prompt: buildWeatherOutfitPrompt({
          weatherSummary: summarizeWeather(forecast.weather),
          preferences,
          schedule,
        }),
        systemPrompt: SYSTEM_PROMPT,
        forceRefresh,
        cacheKey: digestCacheKey({
          location: prefs.location,
          tone: prefs.tone,
          sensitivity: prefs.sensitivity,
          commute: prefs.commute,
          weatherKey: JSON.stringify(summarizeWeather(forecast.weather)),
          scheduleKey: schedule.map((event) => `${event.id}:${event.startTime}`).join(','),
          date,
        }),
      })
      if (validWardrobe(outfitRun.data)) {
        wardrobe = outfitRun.data
        wardrobeMeta = { source: 'ai', loading: false, ...outfitRun.meta }
      }
    } catch {
      // Keep the deterministic wardrobe, but explain why the keys were skipped.
      wardrobeMeta = {
        source: 'fallback',
        loading: false,
        ...(outfitRun?.meta ?? {}),
        rotationNote: outfitRun?.meta?.rotationNote ?? 'Every key was busy, so I used built-in advice.',
      }
    }
    const storedKeys = loadKeys()
    activeKeys = storedKeys.length ? storedKeys : activeKeys

    if (feed.items.length && !feed.offline) {
      try {
        const newsRun = await runWithRotation({
          keys: activeKeys,
          prompt: buildNewsRankingPrompt({
            items: feed.items,
            topics: prefs.topics,
            location: prefs.location,
            tone: prefs.tone,
            politicalLens: prefs.politicalLens,
            coverageMode: prefs.coverageMode,
          }),
          systemPrompt: SYSTEM_PROMPT,
          forceRefresh,
          cacheKey: newsCacheKey({
            location: prefs.location,
            tone: prefs.tone,
            topics: prefs.topics,
            feeds: prefs.feeds,
            politicalLens: prefs.politicalLens,
            coverageMode: prefs.coverageMode,
            date,
          }),
        })
        if (validNews(newsRun.data)) {
          newsDigest = newsRun.data
          newsSource = 'ai'
          newsRankMeta = newsRun.meta
        }
      } catch {
        // Keep raw headlines.
      }
    }
  }

  return {
    schedule,
    calendarMeta: {
      loading: false,
      connected: connected && (calendar.errors ?? []).length === 0,
      errors: calendar.errors ?? [],
    },
    weather: forecast.weather,
    weatherMeta: { source: forecast.source, error: forecast.error, loading: false },
    wardrobe,
    wardrobeMeta,
    rawNews: feed.items,
    newsMeta: { errors: feed.errors, sourceCount: feed.sourceCount },
    newsDigest,
    newsSource,
    newsRankMeta,
    keys: loadKeys().length ? loadKeys() : activeKeys,
  }
}

// Older call sites that already fetched a schedule keep working.
export async function runMorningBriefing({ schedule = [], ...args }) {
  const result = await runMorningDigest(args)
  return { ...result, schedule: schedule.length ? schedule : result.schedule }
}
