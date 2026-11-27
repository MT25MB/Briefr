// Local-only storage. Keys never leave this browser.
import { getActiveAccountId } from './session.js'

const KEYS_KEY = 'briefr_keys'
const PREFS_KEY = 'briefr_prefs'
const CALENDARS_KEY = 'briefr_calendars'
const CACHE_KEY = 'briefr_digest_cache'
const QUICK_EVENTS_KEY = 'briefr_quick_events'
const TRIAGE_KEY = 'briefr_triage'
const DAY_KEY = 'briefr_keys_day'
const MIGRATED_KEY = 'briefr_migrated_v3'
const LEGACY_KEY = 'briefr.settings.v1'

const USER_DATA_KEYS = [KEYS_KEY, PREFS_KEY, CALENDARS_KEY, CACHE_KEY, QUICK_EVENTS_KEY, TRIAGE_KEY, DAY_KEY, MIGRATED_KEY]

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

export const POLITICAL_LENSES = [
  'neutral',
  'conservative',
  'liberal',
  'libertarian',
  'independent',
  'unfiltered',
]

export const POLITICAL_LENS_LABELS = {
  neutral: 'Neutral / Balanced',
  conservative: 'Conservative / Republican',
  liberal: 'Liberal / Democratic',
  libertarian: 'Libertarian',
  independent: 'Independent / Centrist',
  unfiltered: 'None / Unfiltered',
}

export const COVERAGE_MODES = ['aligned', 'balanced']

export const COVERAGE_MODE_LABELS = {
  aligned: 'Aligned Framing',
  balanced: 'Balanced / Multi-Perspective',
}

export const DEFAULT_PREFS = {
  tone: 'Quick Bullets',
  rateLimitSim: false,
  soundAlerts: true,
  onboardingDone: false,
  location: 'Brooklyn, NY',
  sensitivity: 'Runs Cold',
  commute: 'Walk / Transit',
  topics: ['Local', 'Tech & AI'],
  feeds: [],
  politicalLens: 'neutral',
  coverageMode: 'balanced',
  savedPoliticalLens: 'neutral',
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

export function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(scopeKey(key))
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function writeJson(key, value) {
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

const LENS_ALIASES = {
  neutral: 'neutral',
  conservative: 'conservative',
  liberal: 'liberal',
  libertarian: 'libertarian',
  independent: 'independent',
  unfiltered: 'unfiltered',
  'Neutral / Balanced': 'neutral',
  'Balanced / Neutral': 'neutral',
  'Conservative / Republican': 'conservative',
  'Liberal / Democratic': 'liberal',
  'Independent / Centrist': 'independent',
  'None / Unfiltered': 'unfiltered',
  'Custom / No Political Filtering': 'unfiltered',
}
const COVERAGE_ALIASES = {
  aligned: 'aligned',
  balanced: 'balanced',
  'Aligned Lens': 'aligned',
  'Balanced / Both Sides': 'balanced',
  'Cross-perspective': 'balanced',
  'Mostly aligned': 'aligned',
}

export function normalizePoliticalLens(value) {
  return LENS_ALIASES[value] ?? DEFAULT_PREFS.politicalLens
}

export function normalizeCoverageMode(value) {
  return COVERAGE_ALIASES[value] ?? DEFAULT_PREFS.coverageMode
}

export function loadPrefs() {
  migrateLegacy()
  const stored = readJson(PREFS_KEY, {})
  const politicalLens = normalizePoliticalLens(stored.politicalLens)
  const coverageMode = normalizeCoverageMode(stored.coverageMode ?? stored.perspectiveMode)
  const savedPoliticalLens = normalizePoliticalLens(stored.savedPoliticalLens)
  const next = { ...DEFAULT_PREFS, ...stored, politicalLens, coverageMode, savedPoliticalLens }
  delete next.perspectiveMode
  return next
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

function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

// Quick one-off events are plain preferences, never secrets.
export function loadQuickEvents(date = todayKey()) {
  return readJson(QUICK_EVENTS_KEY, []).filter(
    (event) => localDateKey(event.startTime) === date || event.dateKey === date,
  )
}

export function saveQuickEvent(event, date = todayKey()) {
  const events = readJson(QUICK_EVENTS_KEY, []).filter((item) => item.id !== event.id)
  events.push({ ...event, dateKey: date, source: event.source || 'Quick add' })
  writeJson(QUICK_EVENTS_KEY, events)
  return events
}

export function removeQuickEvent(id) {
  writeJson(
    QUICK_EVENTS_KEY,
    readJson(QUICK_EVENTS_KEY, []).filter((event) => event.id !== id),
  )
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

export function newsCacheKey({
  location = '',
  tone = '',
  topics = [],
  feeds = [],
  politicalLens = '',
  coverageMode = '',
} = {}) {
  return `${todayKey()}:news:${hash(
    [location, tone, topics.join(','), feeds.join(','), politicalLens, coverageMode].join('|'),
  )}`
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
