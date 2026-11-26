// One-call morning run: free weather + RSS, optional LLM synthesis, same-day cache.
import { digest, mockWeather } from './mockDigest.js'
import { loadKeys, digestCacheKey, newsCacheKey } from './storage.js'
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
    return { weather: normalizeForecast(forecast, places[0]), source: 'live', error: null }
  } catch (error) {
    return { weather: mockWeather, source: 'mock', error: error.message }
  }
}

async function loadNews(prefs) {
  try {
    const result = await fetchNewsDigest({
      topics: prefs.topics,
      feeds: prefs.feeds,
      location: prefs.location,
    })
    return { items: result.items, errors: result.errors, sourceCount: result.sourceCount }
  } catch {
    return { items: MOCK_NEWS_ITEMS, errors: ['Using offline preview'], sourceCount: 0 }
  }
}

// Coordinates the whole briefing. Falls back to rules + raw headlines at $0.
export async function runMorningBriefing({ prefs, keys = [], forceRefresh = false, schedule = [] }) {
  const [forecast, feed] = await Promise.all([loadWeather(prefs.location), loadNews(prefs)])

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

  if (activeKeys.length) {
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
        rotationNote: outfitRun?.meta?.rotationNote ?? 'Every key was busy — using built-in advice.',
      }
    }
    const storedKeys = loadKeys()
    activeKeys = storedKeys.length ? storedKeys : activeKeys

    if (feed.items.length) {
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
