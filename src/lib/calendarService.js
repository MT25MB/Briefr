// Calendar adapters. Tokens stay in this browser; no Briefr server is involved.
import { loadCalendars, saveCalendars, todayKey } from './storage.js'
import { parseIcsFeed } from '../../api/icsShared.js'

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ')

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize'
const NOTION_API = 'https://api.notion.com/v1'
const OAUTH_STATE_KEY = 'briefr_oauth_state'
const OAUTH_PROVIDER_KEY = 'briefr_oauth_provider'
const PKCE_KEY = 'briefr_pkce_verifier'

const DAY_MS = 86_400_000

function safeUrl(url) {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed : null
  } catch {
    return null
  }
}

function randomString() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function base64Url(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function createPkce() {
  const verifier = randomString() + randomString()
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return { verifier, challenge: base64Url(digest), state: randomString() }
}

function dayBounds(dateKey = todayKey()) {
  const start = new Date(`${dateKey}T00:00:00`)
  return { start, end: new Date(start.getTime() + DAY_MS), dateKey }
}

function normalizeEvent(event) {
  return {
    id: String(event.id ?? `${event.source}-${event.start}-${event.title}`),
    source: event.source ?? 'Calendar',
    title: event.title || '(No title)',
    start: event.start ? new Date(event.start) : null,
    end: event.end ? new Date(event.end) : null,
    allDay: Boolean(event.allDay),
    location: event.location ?? '',
    status: event.status ?? '',
  }
}

export function getOAuthProvider() {
  return localStorage.getItem(OAUTH_PROVIDER_KEY)
}

export function clearOAuthProvider() {
  localStorage.removeItem(OAUTH_PROVIDER_KEY)
}

// ---------- Google Calendar (read-only OAuth with PKCE) ----------

export async function completeGoogleOAuth() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) return null
  const expected = localStorage.getItem(OAUTH_STATE_KEY)
  if (expected && params.get('state') !== expected) throw new Error('Google sign-in did not match. Try again.')
  const verifier = localStorage.getItem(PKCE_KEY)
  const clientId = loadCalendars().google.clientId
  const redirectUri = window.location.origin + window.location.pathname
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      ...(verifier ? { code_verifier: verifier } : {}),
    }),
  })
  if (!response.ok) throw new Error(`Google sign-in failed (${response.status})`)
  const data = await response.json()
  const calendars = loadCalendars()
  calendars.google.token = data.access_token
  saveCalendars(calendars)
  localStorage.removeItem(OAUTH_STATE_KEY)
  localStorage.removeItem(PKCE_KEY)
  window.history.replaceState({}, document.title, window.location.pathname)
  return data.access_token
}

export async function startGoogleOAuthPkce({ clientId, redirectUri = window.location.origin + window.location.pathname }) {
  if (!clientId) throw new Error('Add your Google client ID first.')
  const { verifier, challenge, state } = await createPkce()
  localStorage.setItem(PKCE_KEY, verifier)
  localStorage.setItem(OAUTH_STATE_KEY, state)
  localStorage.setItem(OAUTH_PROVIDER_KEY, 'google')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'online',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  })
  window.location.assign(`${GOOGLE_AUTH_URL}?${params}`)
}

export async function fetchGoogleEvents({ token, date = todayKey() }) {
  if (!token) return []
  const { start, end } = dayBounds(date)
  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  })
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`Google Calendar could not be read (${response.status})`)
  const data = await response.json()
  return (data.items ?? [])
    .filter((item) => item.status !== 'cancelled')
    .map((item) =>
    normalizeEvent({
      id: `google-${item.id}`,
      source: 'Google',
      title: item.summary,
      start: item.start?.dateTime ?? item.start?.date,
      end: item.end?.dateTime ?? item.end?.date,
      allDay: Boolean(item.start?.date),
      location: item.location,
      status: item.status,
    }),
  )
}

// ---------- Notion (integration token or OAuth through a proxy) ----------

export function startNotionOAuth({ clientId, redirectUri }) {
  if (!clientId || !redirectUri) throw new Error('Add a Notion client ID and redirect URL first.')
  const state = randomString()
  localStorage.setItem(OAUTH_STATE_KEY, state)
  localStorage.setItem(OAUTH_PROVIDER_KEY, 'notion')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    owner: 'user',
    state,
  })
  window.location.assign(`${NOTION_AUTH_URL}?${params}`)
}

export async function completeNotionOAuth({ proxyUrl }) {
  const code = new URLSearchParams(window.location.search).get('code')
  if (!code) return null
  if (!safeUrl(proxyUrl)) throw new Error('Notion OAuth needs a trusted proxy URL.')
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'notion', code, redirectUri: window.location.origin + window.location.pathname }),
  })
  if (!response.ok) throw new Error(`Notion sign-in failed (${response.status})`)
  const data = await response.json()
  const calendars = loadCalendars()
  calendars.notion.token = data.access_token
  saveCalendars(calendars)
  window.history.replaceState({}, document.title, window.location.pathname)
  return data.access_token
}

function notionText(property) {
  if (!property) return ''
  if (property.title) return property.title.map((part) => part.plain_text ?? '').join('').trim()
  if (property.rich_text) return property.rich_text.map((part) => part.plain_text ?? '').join('').trim()
  if (property.number !== undefined) return String(property.number)
  if (property.select?.name) return property.select.name
  if (property.url) return property.url
  return ''
}

function findProperty(schema, types) {
  return Object.entries(schema ?? {}).find(([, value]) => types.includes(value.type))?.[0] ?? ''
}

export async function fetchNotionEvents({ token, databaseId, date = todayKey() }) {
  if (!token || !databaseId) return []
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28',
  }
  const schemaResponse = await fetch(`${NOTION_API}/databases/${databaseId}`, { headers })
  if (!schemaResponse.ok) throw new Error(`Notion database could not be read (${schemaResponse.status})`)
  const schema = await schemaResponse.json()
  const properties = schema.properties ?? {}
  const dateProp = findProperty(properties, ['date'])
  const statusProp = findProperty(properties, ['status', 'select'])
  const titleProp = findProperty(properties, ['title'])
  const locationProp = Object.keys(properties).find(
    (name) => name !== titleProp && /location|place|where|address/i.test(name),
  )

  const body = dateProp
    ? { filter: { property: dateProp, date: { equals: date } }, page_size: 100 }
    : { page_size: 100 }
  const queryResponse = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!queryResponse.ok) throw new Error(`Notion entries could not be read (${queryResponse.status})`)
  const query = await queryResponse.json()

  return (query.results ?? [])
    .filter((page) => {
      if (!statusProp) return true
      const status = notionText(page.properties?.[statusProp]).toLowerCase()
      return !['done', 'closed', 'completed', 'archived', 'cancelled'].includes(status)
    })
    .map((page) => {
      const dateValue = page.properties?.[dateProp]?.date
      const start = dateValue?.start ?? null
      const end = dateValue?.end ?? start
      if (start && !start.startsWith(date)) return null
      return normalizeEvent({
        id: `notion-${page.id}`,
        source: 'Notion',
        title: notionText(page.properties?.[titleProp]),
        start,
        end,
        allDay: Boolean(start && start.length === 10),
        location: notionText(page.properties?.[locationProp]),
        status: notionText(page.properties?.[statusProp]),
      })
    })
    .filter(Boolean)
}

// ---------- ICS / iCalendar (Apple, Proton, and other calendar links) ----------

function localTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function parseIcs(text, source = 'Calendar', date = todayKey()) {
  return parseIcsFeed(text, { source, date, timeZone: localTimeZone() }).map((item) => normalizeEvent(item))
}

async function itemsFromIcsService({ url, date, source, proxyUrl }) {
  if (proxyUrl && safeUrl(proxyUrl)) {
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, date, source, timeZone: localTimeZone() }),
    })
    if (!response.ok) throw new Error(`Calendar proxy could not read the feed (${response.status})`)
    const data = await response.json().catch(() => null)
    if (Array.isArray(data?.items)) return data.items
    if (typeof data?.text === 'string' || typeof data?.ics === 'string') {
      return parseIcsFeed(data.text ?? data.ics, { source, date, timeZone: localTimeZone() })
    }
    return []
  }

  const params = new URLSearchParams({ url, date, source, timeZone: localTimeZone() })
  const response = await fetch(`/api/ics?${params}`)
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error ?? `Calendar link could not be read (${response.status})`)
  return data?.items ?? []
}

export async function fetchIcsEvents({ url, source = 'Apple', date = todayKey(), proxyUrl = '' }) {
  if (!url) return []
  const items = await itemsFromIcsService({ url, date, source, proxyUrl })
  return items.map((item) => normalizeEvent({ ...item, source }))
}

export async function fetchCaldavEvents({ proxyUrl, calendarUrl, date = todayKey(), source = 'Apple' }) {
  if (!proxyUrl || !calendarUrl) return []
  if (!safeUrl(proxyUrl)) throw new Error('Add a valid CalDAV proxy address.')
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'caldav', calendarUrl, date, timeZone: localTimeZone() }),
  })
  if (!response.ok) throw new Error(`CalDAV proxy could not be read (${response.status})`)
  const contentType = response.headers.get('Content-Type') ?? ''
  if (contentType.includes('json')) {
    const data = await response.json()
    return (data.items ?? []).map((item) => normalizeEvent({ ...item, source }))
  }
  return parseIcs(await response.text(), source, date)
}

// ---------- Unified view ----------

export async function getTodaysEvents(connections = loadCalendars(), date = todayKey()) {
  const tasks = []
  if (connections.google?.token) {
    tasks.push(
      fetchGoogleEvents({ token: connections.google.token, date }).catch((error) => ({
        error: `Google: ${error.message}`,
      })),
    )
  }
  if (connections.notion?.token && connections.notion?.databaseId) {
    tasks.push(
      fetchNotionEvents({
        token: connections.notion.token,
        databaseId: connections.notion.databaseId,
        date,
      }).catch((error) => ({ error: `Notion: ${error.message}` })),
    )
  }
  ;(connections.ics ?? []).forEach((feed) => {
    if (!feed.url) return
    tasks.push(
      fetchIcsEvents({
        url: feed.url,
        source: feed.source ?? 'Apple',
        date,
        proxyUrl: feed.proxyUrl ?? '',
      }).catch((error) => ({ error: `${feed.source ?? 'Calendar'}: ${error.message}` })),
    )
  })
  if (connections.caldav?.proxyUrl && connections.caldav?.calendarUrl) {
    tasks.push(
      fetchCaldavEvents({
        proxyUrl: connections.caldav.proxyUrl,
        calendarUrl: connections.caldav.calendarUrl,
        date,
        source: 'Apple',
      }).catch((error) => ({ error: `Apple CalDAV: ${error.message}` })),
    )
  }

  const results = await Promise.allSettled(tasks)
  const errors = []
  const events = []
  results.forEach((result) => {
    if (result.status !== 'fulfilled') {
      errors.push(result.reason?.message ?? 'A calendar could not be read')
      return
    }
    const value = result.value
    if (Array.isArray(value)) events.push(...value)
    else if (value?.error) errors.push(value.error)
  })

  const seen = new Set()
  return {
    events: events
      .filter((event) => {
        const key = `${event.source}-${event.title}-${event.start?.getTime()}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0)),
    errors,
  }
}
