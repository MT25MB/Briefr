// Local-only storage. Keys never leave this browser.
import { getActiveAccountId } from './session.js'

const KEYS_KEY = 'briefr_keys'
const PREFS_KEY = 'briefr_prefs'
const CALENDARS_KEY = 'briefr_calendars'
const CACHE_KEY = 'briefr_digest_cache'
const DAY_KEY = 'briefr_keys_day'
const MIGRATED_KEY = 'briefr_migrated_v3'
const LEGACY_KEY = 'briefr.settings.v1'

const USER_DATA_KEYS = [KEYS_KEY, PREFS_KEY, CALENDARS_KEY, CACHE_KEY, DAY_KEY, MIGRATED_KEY]

export function scopeKey(key, accountId = getActiveAccountId()) {
  return accountId ? `briefr_${accountId}_${key}` : key
}

export function wipeScope(accountId) {
  try {
    USER_DATA_KEYS.forEach((key) => localStorage.removeItem(scopeKey(key, accountId)))
  } catch {
    // Ignore storage errors.
  }
}

export function copyAnonymousDataToScope(accountId) {
  try {
    USER_DATA_KEYS.forEach((key) => {
      const source = localStorage.getItem(key)
      const target = scopeKey(key, accountId)
      if (source && !localStorage.getItem(target)) localStorage.setItem(target, source)
    })
  } catch {
    // Best effort: a fresh account can start from defaults.
  }
}

export const TONES = ['Quick Bullets', 'Friendly', 'Direct']

export const DEFAULT_PREFS = {
  tone: 'Quick Bullets',
  rateLimitSim: false,
  onboardingDone: false,
  location: 'Brooklyn, NY',
  sensitivity: 'Runs Cold',
  commute: 'Walk / Transit',
  topics: ['Local', 'Tech & AI'],
  feeds: [],
}

export const DEFAULT_CALENDARS = {
  google: { clientId: '', token: null },
  notion: { token: null, databaseId: '', clientId: '', redirectUri: '', proxyUrl: '' },
  ics: [],
  caldav: { proxyUrl: '', calendarUrl: '' },
}

const DEFAULT_BASE_URLS = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  ollama: 'http://localhost:11434/v1',
}

export function todayKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(scopeKey(key))
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(scopeKey(key), JSON.stringify(value))
  } catch {
    // Private browsing or storage full — the app still works in memory.
  }
}

function migrateLegacy() {
  try {
    if (localStorage.getItem(scopeKey(MIGRATED_KEY))) return
    const legacy = readJson(LEGACY_KEY, null)
    if (legacy) {
      const keys = (legacy.keys ?? []).map((key) => ({
        id: key.id ?? `key_${Math.random().toString(36).slice(2, 10)}`,
        provider: key.provider,
        apiKey: key.apiKey ?? key.value ?? '',
        label: key.label ?? `${key.provider} key`,
        baseUrl: DEFAULT_BASE_URLS[key.provider] ?? '',
        cooldownUntil: null,
        dailyExhausted: key.status === 'exhausted',
        lastError: key.status === 'invalid' ? 'Invalid API key' : null,
      }))
      const prefs = {
        ...DEFAULT_PREFS,
        tone: legacy.tone ?? DEFAULT_PREFS.tone,
        rateLimitSim: legacy.rateLimitSim ?? false,
        onboardingDone: legacy.onboardingDone ?? false,
        location: legacy.location ?? DEFAULT_PREFS.location,
        sensitivity: legacy.sensitivity ?? DEFAULT_PREFS.sensitivity,
        commute: legacy.commute ?? DEFAULT_PREFS.commute,
        topics: legacy.topics ?? DEFAULT_PREFS.topics,
        feeds: legacy.feeds ?? DEFAULT_PREFS.feeds,
      }
      writeJson(KEYS_KEY, keys)
      writeJson(PREFS_KEY, prefs)
      localStorage.removeItem(LEGACY_KEY)
    }
    localStorage.setItem(scopeKey(MIGRATED_KEY), '1')
  } catch {
    // Migration is best effort.
  }
}

function resetDailyFlagsIfNeeded() {
  const today = todayKey()
  try {
    if (localStorage.getItem(scopeKey(DAY_KEY)) === today) return
    const keys = readJson(KEYS_KEY, [])
    writeJson(
      KEYS_KEY,
      keys.map((key) => ({ ...key, dailyExhausted: false })),
    )
    localStorage.setItem(scopeKey(DAY_KEY), today)
  } catch {
    // Ignore storage errors.
  }
}

export function loadPrefs() {
  migrateLegacy()
  return { ...DEFAULT_PREFS, ...readJson(PREFS_KEY, {}) }
}

export function savePrefs(prefs) {
  writeJson(PREFS_KEY, prefs)
}

export function loadKeys() {
  migrateLegacy()
  resetDailyFlagsIfNeeded()
  return readJson(KEYS_KEY, [])
}

export function saveKeys(keys) {
  writeJson(KEYS_KEY, keys)
}

export function loadCalendars() {
  migrateLegacy()
  return { ...DEFAULT_CALENDARS, ...readJson(CALENDARS_KEY, {}) }
}

export function saveCalendars(calendars) {
  writeJson(CALENDARS_KEY, calendars)
}

export function defaultBaseUrl(provider) {
  return DEFAULT_BASE_URLS[provider] ?? ''
}

function hash(value) {
  let result = 0
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(result).toString(36)
}

// YYYY-MM-DD + hash of the inputs that change the briefing.
export function digestCacheKey({ location = '', tone = '', sensitivity = '', commute = '' } = {}) {
  return `${todayKey()}:${hash([location, tone, sensitivity, commute].join('|'))}`
}

export function newsCacheKey({ location = '', tone = '', topics = [], feeds = [] } = {}) {
  return `${todayKey()}:news:${hash([location, tone, topics.join(','), feeds.join(',')].join('|'))}`
}

function loadCache() {
  const cache = readJson(CACHE_KEY, {})
  const today = todayKey()
  const fresh = Object.fromEntries(Object.entries(cache).filter(([key]) => key.startsWith(`${today}:`)))
  if (Object.keys(fresh).length !== Object.keys(cache).length) writeJson(CACHE_KEY, fresh)
  return fresh
}

export function getCachedDigest(cacheKey) {
  return loadCache()[cacheKey] ?? null
}

export function setCachedDigest(cacheKey, entry) {
  writeJson(CACHE_KEY, { ...loadCache(), [cacheKey]: entry })
}

export function clearDigestCache() {
  writeJson(CACHE_KEY, {})
}

export function clearAllStorage() {
  wipeScope(getActiveAccountId())
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // Ignore storage errors.
  }
}
