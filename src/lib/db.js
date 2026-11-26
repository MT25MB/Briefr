// User-scoped cloud preferences. Secrets are never written here.
import { getSupabase, getCurrentAccount } from './auth.js'
import { clearDigestCache, scopeKey } from './storage.js'

const TABLE = 'briefr_preferences'

const PREF_FIELDS = [
  'tone',
  'location',
  'sensitivity',
  'commute',
  'topics',
  'feeds',
  'politicalLens',
  'coverageMode',
  'onboardingDone',
  'rateLimitSim',
]

export function publicPreferences(prefs = {}) {
  const result = {}
  PREF_FIELDS.forEach((field) => {
    if (prefs[field] !== undefined) result[field] = prefs[field]
  })
  return result
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
    ics: (calendars.ics ?? []).map((feed) => ({ id: feed.id, source: feed.source, url: feed.url })),
    caldav: {
      proxyUrl: calendars.caldav?.proxyUrl ?? '',
      calendarUrl: calendars.caldav?.calendarUrl ?? '',
    },
  }
}

export async function loadCloudData(userId) {
  const supabase = await getSupabase()
  if (!supabase || !userId) return null
  const { data, error } = await supabase.from(TABLE).select('data').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.data ?? null
}

export async function saveCloudData(userId, { prefs = {}, calendars = {} }) {
  const supabase = await getSupabase()
  if (!supabase || !userId) return
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      data: { prefs: publicPreferences(prefs), calendars: publicCalendarConfig(calendars) },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(error.message)
}

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
