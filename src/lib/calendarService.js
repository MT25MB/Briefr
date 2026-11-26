// Calendar adapters. Tokens stay in this browser; no Briefr server is involved.
import { loadCalendars, saveCalendars, todayKey } from './storage.js'

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
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

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
  })
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`Google Calendar could not be read (${response.status})`)
  const data = await response.json()
  return (data.items ?? []).map((item) =>
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

function unfoldIcs(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .reduce((lines, line) => {
      if (/^[ \t]/.test(line) && lines.length) lines[lines.length - 1] += line.slice(1)
      else lines.push(line)
      return lines
    }, [])
}

function parseLine(line) {
  const colon = line.indexOf(':')
  if (colon < 0) return null
  const left = line.slice(0, colon)
  const value = line.slice(colon + 1).trim()
  const [name, ...params] = left.split(';')
  return {
    name: name.toUpperCase(),
    value,
    params: Object.fromEntries(params.map((part) => part.split('=').map((item) => item.toUpperCase()))),
  }
}

function timeZoneOffsetMs(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {})
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second),
    )
    return asUtc - date.getTime()
  } catch {
    return 0
  }
}

function zonedWallTimeToDate(value, timeZone) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?/)
  if (!match) return new Date(value)
  const [, year, month, day, hour, minute, second = '00'] = match
  const wall = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second)
  let guess = new Date(wall)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const next = new Date(wall - timeZoneOffsetMs(guess, timeZone))
    if (next.getTime() === guess.getTime()) break
    guess = next
  }
  return guess
}

function parseIcsDate(value, params = {}) {
  const text = String(value ?? '').trim()
  if (/^\d{8}$/.test(text) || params.VALUE === 'DATE') {
    return {
      date: new Date(`${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T00:00:00`),
      allDay: true,
    }
  }
  if (text.endsWith('Z')) return { date: new Date(text), allDay: false }
  const timeZone = params.TZID
  const date = timeZone && Intl.DateTimeFormat().resolvedOptions().timeZone !== timeZone
    ? zonedWallTimeToDate(text, timeZone)
    : new Date(
        text
          .replace(/^(\d{4})(\d{2})(\d{2})T/, '$1-$2-$3T')
          .replace(/T(\d{2})(\d{2})(\d{2})?/, (_, hour, minute, second) =>
            `T${hour}:${minute}${second ? `:${second}` : ''}`,
          ),
      )
  return { date, allDay: false }
}

function rruleMatches(rrule, originalStart, candidate) {
  const rule =
    rrule && typeof rrule === 'object'
      ? rrule
      : Object.fromEntries(
          String(rrule ?? '')
            .replace(/^RRULE:/i, '')
            .split(';')
            .filter(Boolean)
            .map((part) => part.split('=').map((item) => item.toUpperCase())),
        )
  const frequency = rule.FREQ ?? ''
  const interval = Math.max(1, Number(rule.INTERVAL) || 1)
  const days = new Set((rule.BYDAY ?? '').split(',').filter(Boolean))
  const weekday = WEEKDAYS[candidate.getDay()]
  const sameDay = candidate.getDate() === originalStart.getDate()
  const sameMonth = candidate.getMonth() === originalStart.getMonth()
  const dayDiff = Math.round((candidate - originalStart) / DAY_MS)
  const monthDiff =
    (candidate.getFullYear() - originalStart.getFullYear()) * 12 + candidate.getMonth() - originalStart.getMonth()

  if (frequency === 'DAILY') return dayDiff % interval === 0 && (!days.size || days.has(weekday))
  if (frequency === 'WEEKLY') {
    if (days.size) return days.has(weekday) && Math.floor(dayDiff / 7) % interval === 0
    return weekday === WEEKDAYS[originalStart.getDay()] && dayDiff % (7 * interval) === 0
  }
  if (frequency === 'MONTHLY') return sameDay && monthDiff % interval === 0
  if (frequency === 'YEARLY') {
    return sameDay && sameMonth && (candidate.getFullYear() - originalStart.getFullYear()) % interval === 0
  }
  return false
}

function recurrenceOccurrences(event, target) {
  const original = parseIcsDate(event.start, event.params ?? {})
  if (!Number.isNaN(original.date.getTime())) {
    const end = event.end ? parseIcsDate(event.end, event.params ?? {}).date : new Date(original.date.getTime() + 3_600_000)
    const duration = Math.max(0, end - original.date)
    if (!event.rrule) {
      if (original.date <= target.end && end >= target.start) return [original.date]
      return []
    }
    const rule = Object.fromEntries(
      String(event.rrule).replace(/^RRULE:/i, '').split(';').filter(Boolean).map((part) => part.split('=')),
    )
    const until = rule.UNTIL ? parseIcsDate(rule.UNTIL).date : null
    const count = Number(rule.COUNT) || Infinity
    const exdates = new Set((event.exdates ?? []).map((item) => parseIcsDate(item).date.toDateString()))
    const occurrences = []
    let seen = 0
    for (let cursor = new Date(original.date); cursor <= target.end && seen < 800; cursor = new Date(cursor.getTime() + DAY_MS)) {
      if (until && cursor > until) break
      if (cursor >= original.date && rruleMatches(rule, original.date, cursor)) {
        seen += 1
        if (seen > count) break
        if (!exdates.has(cursor.toDateString())) {
          const occurrenceEnd = new Date(cursor.getTime() + duration)
          if (cursor <= target.end && occurrenceEnd >= target.start) occurrences.push(cursor)
        }
      }
    }
    return occurrences
  }
  return []
}

export function parseIcs(text, source = 'Calendar', date = todayKey()) {
  const target = dayBounds(date)
  const blocks = unfoldIcs(text)
    .join('\n')
    .split(/BEGIN:VEVENT/i)
    .slice(1)
    .map((block) => block.split(/END:VEVENT/i)[0])

  return blocks.flatMap((block, index) => {
    const fields = block
      .split('\n')
      .map(parseLine)
      .filter(Boolean)
    const get = (name) => fields.find((field) => field.name === name)
    const startField = get('DTSTART')
    if (!startField) return []
    const event = {
      uid: get('UID')?.value ?? `${source}-${index}`,
      title: get('SUMMARY')?.value ?? '(No title)',
      location: get('LOCATION')?.value ?? '',
      start: startField.value,
      end: get('DTEND')?.value ?? '',
      params: startField.params,
      rrule: get('RRULE')?.value ?? '',
      exdates: fields.filter((field) => field.name === 'EXDATE').map((field) => field.value),
    }
    return recurrenceOccurrences(event, target).map((start, occurrenceIndex) => {
      const parsedEnd = event.end ? parseIcsDate(event.end, event.params).date : null
      const duration = parsedEnd && !Number.isNaN(parsedEnd.getTime())
        ? parsedEnd - parseIcsDate(event.start, event.params).date
        : 3_600_000
      return normalizeEvent({
        id: `${source.toLowerCase()}-${event.uid}-${occurrenceIndex}`,
        source,
        title: event.title,
        start,
        end: new Date(start.getTime() + duration),
        allDay: parseIcsDate(event.start, event.params).allDay,
        location: event.location,
      })
    })
  })
}

async function readFeedAsText(url, proxyUrl) {
  if (proxyUrl && safeUrl(proxyUrl)) {
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (!response.ok) throw new Error(`Calendar proxy could not read the feed (${response.status})`)
    const data = await response.json().catch(() => null)
    return data?.text ?? data?.ics ?? JSON.stringify(data)
  }
  const response = await fetch(url, { headers: { Accept: 'text/calendar, text/plain, */*' } })
  if (!response.ok) throw new Error(`Calendar link could not be read (${response.status})`)
  return response.text()
}

export async function fetchIcsEvents({ url, source = 'Apple', date = todayKey(), proxyUrl = '' }) {
  if (!url) return []
  const text = await readFeedAsText(url, proxyUrl)
  if (text.trim().startsWith('{')) {
    const data = JSON.parse(text)
    return (data.items ?? []).map((item) => normalizeEvent({ ...item, source }))
  }
  return parseIcs(text, source, date)
}

export async function fetchCaldavEvents({ proxyUrl, calendarUrl, date = todayKey(), source = 'Apple' }) {
  if (!proxyUrl || !calendarUrl) return []
  if (!safeUrl(proxyUrl)) throw new Error('Add a valid CalDAV proxy address.')
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'caldav', calendarUrl, date }),
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
