// Calendar adapters. Tokens stay in this browser; no Briefr server is involved.
import { loadCalendars, loadQuickEvents, saveCalendars, todayKey } from './storage.js'
import { parseIcsFeed, validateIcsUrl, zonedDayBounds } from '../../api/icsShared.js'

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
  return { ...zonedDayBounds(dateKey, localTimeZone()), dateKey }
}

function toIso(value, allDay = false) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    // All-day dates stay on the local calendar day, not UTC midnight.
    return new Date(allDay ? `${text}T00:00:00` : text).toISOString()
  }
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

// Every adapter speaks this one shape. Start/end are ISO strings so the
// schedule can be passed to prompts and storage without losing meaning.
export function normalizeEvent(event) {
  const isAllDay = Boolean(event.isAllDay ?? event.allDay)
  return {
    id: String(event.id ?? `${event.source}-${event.startTime ?? event.start}-${event.title}`),
    title: event.title || '(No title)',
    startTime: toIso(event.startTime ?? event.start, isAllDay),
    endTime: toIso(event.endTime ?? event.end, isAllDay),
    isAllDay,
    location: event.location ?? '',
    source: event.source ?? 'Calendar',
    status: event.status ?? '',
    notes: event.notes ?? '',
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
  try {
    const expected = localStorage.getItem(OAUTH_STATE_KEY)
    const verifier = localStorage.getItem(PKCE_KEY)
    if (!expected || params.get('state') !== expected) {
      throw new Error('Google sign-in did not match. Try again.')
    }
    if (!verifier) throw new Error('Google sign-in expired. Try again.')
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
        code_verifier: verifier,
      }),
    })
    if (!response.ok) throw new Error(`Google sign-in failed (${response.status})`)
    const data = await response.json()
    const calendars = loadCalendars()
    calendars.google.token = data.access_token
    saveCalendars(calendars)
    window.history.replaceState({}, document.title, window.location.pathname)
    return data.access_token
  } finally {
    localStorage.removeItem(OAUTH_STATE_KEY)
    localStorage.removeItem(PKCE_KEY)
  }
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
  const items = []
  let pageToken = ''
  let pages = 0

  do {
    const params = new URLSearchParams({
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      timeZone: localTimeZone(),
      ...(pageToken ? { pageToken } : {}),
    })
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!response.ok) throw new Error(`Google Calendar could not be read (${response.status})`)
    const data = await response.json()
    items.push(...(data.items ?? []))
    pageToken = data.nextPageToken ?? ''
    pages += 1
  } while (pageToken && pages < 20)

  return items
    .filter((item) => item.status !== 'cancelled')
    .map((item) =>
      normalizeEvent({
        id: `google-${item.id}`,
        source: 'Google',
        title: item.summary,
        startTime: item.start?.dateTime ?? item.start?.date,
        endTime: item.end?.dateTime ?? item.end?.date,
        isAllDay: Boolean(item.start?.date),
        location: item.location,
        status: item.status,
        notes: item.description,
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
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) return null
  try {
    const expected = localStorage.getItem(OAUTH_STATE_KEY)
    if (!expected || params.get('state') !== expected) {
      throw new Error('Notion sign-in did not match. Try again.')
    }
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
  } finally {
    localStorage.removeItem(OAUTH_STATE_KEY)
  }
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

function notionTags(property) {
  if (!property) return ''
  if (Array.isArray(property.multi_select)) return property.multi_select.map((item) => item.name).join(', ')
  if (property.select?.name) return property.select.name
  if (property.status?.name) return property.status.name
  return notionText(property)
}

function overlapsLocalDay(start, end, date) {
  if (!start) return false
  const toDate = (value) =>
    new Date(String(value).length === 10 ? `${value}T00:00:00` : value)
  const dayStart = new Date(`${date}T00:00:00`)
  const dayEnd = new Date(`${date}T23:59:59.999`)
  const from = toDate(start)
  const until = end ? toDate(end) : from
  return from <= dayEnd && until >= dayStart
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
  const notesProp = Object.keys(properties).find(
    (name) => name !== titleProp && /notes?|description|details|prep/i.test(name),
  )
  const tagProp = Object.keys(properties).find(
    (name) =>
      name !== titleProp &&
      name !== statusProp &&
      ['multi_select', 'select'].includes(properties[name]?.type) &&
      /tag|topic|label|category|type/i.test(name),
  )

  const pages = []
  let cursor = ''
  let requests = 0
  do {
    const body = {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    }
    const queryResponse = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!queryResponse.ok) throw new Error(`Notion entries could not be read (${queryResponse.status})`)
    const query = await queryResponse.json()
    pages.push(...(query.results ?? []))
    cursor = query.has_more ? query.next_cursor : ''
    requests += 1
  } while (cursor && requests < 20)

  return pages
    .filter((page) => {
      if (!statusProp) return true
      const status = notionText(page.properties?.[statusProp]).toLowerCase()
      return !['done', 'closed', 'completed', 'archived', 'cancelled'].includes(status)
    })
    .map((page) => {
      const dateValue = page.properties?.[dateProp]?.date
      const start = dateValue?.start ?? null
      const end = dateValue?.end ?? start
      if (!overlapsLocalDay(start, end, date)) return null
      const notes = notionText(page.properties?.[notesProp])
      const tags = notionTags(page.properties?.[tagProp])
      return normalizeEvent({
        id: `notion-${page.id}`,
        source: 'Notion',
        title: notionText(page.properties?.[titleProp]),
        startTime: start,
        endTime: end,
        isAllDay: Boolean(start && start.length === 10),
        location: notionText(page.properties?.[locationProp]),
        status: notionText(page.properties?.[statusProp]),
        notes: [notes, tags && `Tags: ${tags}`].filter(Boolean).join(' · '),
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

async function fetchIcsDirect({ url, date, source }) {
  const target = validateIcsUrl(url)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(target.href, {
      signal: controller.signal,
      headers: { Accept: 'text/calendar, text/plain, */*' },
    })
    if (!response.ok) throw new Error(`Calendar link could not be read (${response.status})`)
    const text = await response.text()
    return parseIcsFeed(text, { source, date, timeZone: localTimeZone() })
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Calendar link timed out')
    throw new Error('Calendar link could not be read directly')
  } finally {
    window.clearTimeout(timeout)
  }
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
  try {
    const response = await fetch(`/api/ics?${params}`)
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.error ?? `Calendar link could not be read (${response.status})`)
    return data?.items ?? []
  } catch {
    // Vite dev has no Pages Functions; try the same validated fetch in-browser.
    return fetchIcsDirect({ url, date, source })
  }
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
  const allEvents = [...events, ...loadQuickEvents(date).map((event) => normalizeEvent(event))]
  return {
    events: allEvents
      .filter((event) => {
        const key = `${event.source}-${event.title}-${event.startTime}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => {
        if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1
        return (a.startTime ?? '').localeCompare(b.startTime ?? '')
      }),
    errors,
  }
}
