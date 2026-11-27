// User-scoped cloud data. Only non-secret preferences and public identifiers
// are written here. BYOK keys and calendar tokens never leave localStorage.
import { getSupabase, getCurrentAccount } from './auth.js'
import {
  DEFAULT_PREFS,
  clearDigestCache,
  normalizeCoverageMode,
  normalizePoliticalLens,
  scopeKey,
} from './storage.js'

const PROFILES_TABLE = 'user_profiles'
const PREFS_TABLE = 'user_preferences'
const CALENDARS_TABLE = 'calendar_sources'
const TRIAGE_TABLE = 'triage_items'

function string(value = '') {
  return String(value ?? '').slice(0, 500)
}

export function publicPreferences(prefs = {}) {
  return {
    location: string(prefs.location ?? DEFAULT_PREFS.location),
    wardrobe_prefs: {
      sensitivity: prefs.sensitivity ?? DEFAULT_PREFS.sensitivity,
      commute: prefs.commute ?? DEFAULT_PREFS.commute,
      onboardingDone: Boolean(prefs.onboardingDone),
      rateLimitSim: Boolean(prefs.rateLimitSim),
      soundAlerts: prefs.soundAlerts !== false,
      savedPoliticalLens: normalizePoliticalLens(prefs.savedPoliticalLens),
    },
    tone: prefs.tone ?? DEFAULT_PREFS.tone,
    political_lens: normalizePoliticalLens(prefs.politicalLens),
    coverage_mode: normalizeCoverageMode(prefs.coverageMode),
    news_packs: Array.isArray(prefs.topics) ? prefs.topics : DEFAULT_PREFS.topics,
    custom_feeds: Array.isArray(prefs.feeds) ? prefs.feeds : [],
  }
}

function toPrefs(row) {
  if (!row) return null
  const wardrobe = row.wardrobe_prefs ?? {}
  return {
    ...DEFAULT_PREFS,
    location: row.location ?? DEFAULT_PREFS.location,
    sensitivity: wardrobe.sensitivity ?? DEFAULT_PREFS.sensitivity,
    commute: wardrobe.commute ?? DEFAULT_PREFS.commute,
    tone: row.tone ?? DEFAULT_PREFS.tone,
    politicalLens: normalizePoliticalLens(row.political_lens),
    coverageMode: normalizeCoverageMode(row.coverage_mode),
    savedPoliticalLens: normalizePoliticalLens(wardrobe.savedPoliticalLens),
    topics: Array.isArray(row.news_packs) ? row.news_packs : DEFAULT_PREFS.topics,
    feeds: Array.isArray(row.custom_feeds) ? row.custom_feeds : [],
    onboardingDone: Boolean(wardrobe.onboardingDone),
    rateLimitSim: Boolean(wardrobe.rateLimitSim),
    soundAlerts: wardrobe.soundAlerts !== false,
  }
}

export function publicCalendarConfig(calendars = {}) {
  return {
    google: { clientId: calendars.google?.clientId ?? '' },
    notion: {
      databaseId: calendars.notion?.databaseId ?? '',
      clientId: calendars.notion?.clientId ?? '',
      redirectUri: calendars.notion?.redirectUri ?? '',
      proxyUrl: calendars.notion?.proxyUrl ?? '',
    },
    // Private ICS/CalDAV URLs are bearer capabilities — they stay on this device.
    ics: (calendars.ics ?? []).map((feed) => ({
      id: feed.id,
      source: feed.source,
    })),
    caldav: {},
  }
}

function calendarRows(userId, calendars = {}) {
  const clean = publicCalendarConfig(calendars)
  const rows = []
  if (clean.google.clientId) {
    rows.push({ user_id: userId, provider: 'google', config: { clientId: clean.google.clientId } })
  }
  if (
    clean.notion.databaseId ||
    clean.notion.clientId ||
    clean.notion.redirectUri ||
    clean.notion.proxyUrl
  ) {
    rows.push({
      user_id: userId,
      provider: 'notion',
      config: {
        clientId: clean.notion.clientId,
        redirectUri: clean.notion.redirectUri,
        proxyUrl: clean.notion.proxyUrl,
      },
      database_id: clean.notion.databaseId,
    })
  }
  // No ICS/CalDAV rows: their URLs are secrets and never leave this browser.
  return rows
}

function toCalendarConfig(rows = []) {
  const calendars = {
    google: { clientId: '' },
    notion: { token: null, databaseId: '', clientId: '', redirectUri: '', proxyUrl: '' },
    ics: [],
    caldav: { proxyUrl: '', calendarUrl: '' },
  }
  rows.forEach((row) => {
    const config = row.config ?? {}
    if (row.provider === 'google') calendars.google.clientId = config.clientId ?? ''
    if (row.provider === 'notion') {
      calendars.notion.databaseId = row.database_id ?? ''
      calendars.notion.clientId = config.clientId ?? ''
      calendars.notion.redirectUri = config.redirectUri ?? ''
      calendars.notion.proxyUrl = config.proxyUrl ?? ''
    }
    if (row.provider === 'apple' || row.provider === 'proton') {
      calendars.ics.push({
        id: config.id ?? row.id,
        source: config.source ?? (row.provider === 'proton' ? 'Proton' : 'Apple'),
        url: row.feed_url ?? '',
      })
    }
    if (row.provider === 'caldav') {
      calendars.caldav.proxyUrl = config.proxyUrl ?? ''
      calendars.caldav.calendarUrl = config.calendarUrl ?? ''
    }
  })
  return calendars
}

export async function saveProfile(userId, { displayName = '', email = '' } = {}) {
  const supabase = await getSupabase()
  if (!supabase || !userId) return
  const { error } = await supabase.from(PROFILES_TABLE).upsert(
    {
      user_id: userId,
      display_name: string(displayName),
      email: string(email),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(error.message)
}

export async function loadCloudData(userId) {
  const supabase = await getSupabase()
  if (!supabase || !userId) return null

  const [{ data: preferenceRow, error: prefError }, { data: sourceRows, error: sourceError }] =
    await Promise.all([
      supabase.from(PREFS_TABLE).select('*').eq('user_id', userId).maybeSingle(),
      supabase.from(CALENDARS_TABLE).select('*').eq('user_id', userId),
    ])
  if (prefError) throw new Error(prefError.message)
  if (sourceError) throw new Error(sourceError.message)

  return {
    prefs: toPrefs(preferenceRow),
    calendars: sourceRows?.length ? toCalendarConfig(sourceRows) : null,
  }
}

export async function saveCloudData(userId, { prefs = {}, calendars = {} } = {}) {
  const supabase = await getSupabase()
  if (!supabase || !userId) return

  const { error: prefError } = await supabase.from(PREFS_TABLE).upsert(
    { ...publicPreferences(prefs), user_id: userId, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
  if (prefError) throw new Error(prefError.message)

  const { error: deleteError } = await supabase.from(CALENDARS_TABLE).delete().eq('user_id', userId)
  if (deleteError) throw new Error(deleteError.message)
  const rows = calendarRows(userId, calendars)
  if (rows.length) {
    const { error: insertError } = await supabase.from(CALENDARS_TABLE).insert(rows)
    if (insertError) throw new Error(insertError.message)
  }
}

// ---------- Daily triage cloud sync ----------

function triageCategory(key) {
  if (key === 'needsAction') return 'needs_action'
  if (key === 'fyi') return 'fyi'
  return 'noise'
}

function categoryKey(value) {
  if (value === 'needs_action') return 'needsAction'
  if (value === 'fyi') return 'fyi'
  return 'noiseItems'
}

export async function loadCloudTriage(userId, date) {
  const supabase = await getSupabase()
  if (!supabase || !userId) return null
  const { data, error } = await supabase
    .from(TRIAGE_TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('day', date)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  if (!data?.length) return null

  const result = {
    dateKey: date,
    source: 'cloud',
    needsAction: [],
    fyi: [],
    noiseCount: 0,
    noiseItems: [],
  }
  data.forEach((row) => {
    const item = {
      id: row.id,
      sender: row.sender ?? '',
      summary: row.summary ?? '',
    }
    const key = categoryKey(row.category)
    if (key === 'needsAction') {
      result.needsAction.push({
        ...item,
        suggestedAction: row.suggested_action ?? '',
        urgency: row.urgency ?? '',
        scheduleNote: row.schedule_note ?? '',
        done: Boolean(row.completed),
      })
    } else {
      result[key].push(item)
    }
  })
  result.noiseCount = result.noiseItems.length
  return result
}

export async function saveCloudTriage(userId, triage) {
  const supabase = await getSupabase()
  if (!supabase || !userId || !triage?.dateKey) return
  const { error: deleteError } = await supabase
    .from(TRIAGE_TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('day', triage.dateKey)
  if (deleteError) throw new Error(deleteError.message)

  const rows = ['needsAction', 'fyi', 'noiseItems'].flatMap((key) =>
    (triage[key] ?? []).map((item) => ({
      user_id: userId,
      day: triage.dateKey,
      category: triageCategory(key),
      sender: string(item.sender),
      summary: string(item.summary),
      suggested_action: string(item.suggestedAction),
      urgency: string(item.urgency),
      schedule_note: string(item.scheduleNote),
      completed: key === 'needsAction' ? Boolean(item.done) : false,
    })),
  )
  if (rows.length) {
    const { error: insertError } = await supabase.from(TRIAGE_TABLE).insert(rows)
    if (insertError) throw new Error(insertError.message)
  }
}

export async function clearCloudTriage(userId, date) {
  const supabase = await getSupabase()
  if (!supabase || !userId) return
  const { error } = await supabase.from(TRIAGE_TABLE).delete().eq('user_id', userId).eq('day', date)
  if (error) throw new Error(error.message)
}

// ---------- Export / local cache ----------

function readScope(key) {
  try {
    return JSON.parse(localStorage.getItem(scopeKey(key)) ?? 'null')
  } catch {
    return null
  }
}

export function exportAccountData({ includeSecrets = false } = {}) {
  const account = getCurrentAccount()
  if (!account) throw new Error('Sign in first to export your data.')
  const calendars = readScope('briefr_calendars') ?? {}
  const keys = readScope('briefr_keys') ?? []
  return {
    exportedAt: new Date().toISOString(),
    account: { email: account.email, name: account.name, localOnly: account.localOnly },
    preferences: readScope('briefr_prefs'),
    calendars: includeSecrets ? calendars : publicCalendarConfig(calendars),
    keys: includeSecrets ? keys : keys.map((key) => ({ ...key, apiKey: '[hidden]' })),
    cachedDigests: readScope('briefr_digest_cache'),
    note: 'Secrets are hidden by default. This file is generated in your browser.',
  }
}

export function clearCachedDigest() {
  clearDigestCache()
}
