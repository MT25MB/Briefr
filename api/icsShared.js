// Pure ICS parsing shared by the browser adapter and the Cloudflare Pages Function.
const DAY_MS = 86_400_000
const MAX_TEXT = 2_000_000
const WEEKDAY_CODES = { Sun: 'SU', Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH', Fri: 'FR', Sat: 'SA' }

export function validateIcsUrl(raw) {
  if (!raw) throw Object.assign(new Error('Missing url parameter'), { status: 400 })
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    throw Object.assign(new Error('Invalid URL'), { status: 400 })
  }
  if (parsed.protocol !== 'https:') {
    throw Object.assign(new Error('Only https calendar links are allowed'), { status: 400 })
  }
  const host = parsed.hostname.toLowerCase()
  const blocked =
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.startsWith('[') ||
    host.endsWith('.localhost') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  if (blocked) throw Object.assign(new Error('Private addresses are not allowed'), { status: 400 })
  return parsed
}

// Re-validate every redirect hop; a public link must not reach a private host.
async function fetchIcsSafely(target, options, maxHops = 3) {
  let current = target
  for (let hop = 0; hop <= maxHops; hop += 1) {
    const response = await fetch(current, { ...options, redirect: 'manual' })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers?.get?.('location')
      if (!location || hop === maxHops) {
        throw Object.assign(new Error('Too many redirects'), { status: 400 })
      }
      current = validateIcsUrl(new URL(location, current).href)
      continue
    }
    return response
  }
  throw Object.assign(new Error('Too many redirects'), { status: 400 })
}

async function readCappedText(response, maxBytes) {
  const declared = Number(response.headers?.get?.('content-length') ?? 0)
  if (declared > maxBytes) return null
  if (!response.body?.getReader) {
    const text = await response.text()
    return text.length <= maxBytes ? text : null
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let text = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) return null
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
  } finally {
    reader.releaseLock?.()
  }
  return text.length <= maxBytes ? text : null
}

function partsInZone(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {})
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour) % 24,
      minute: Number(parts.minute),
      second: Number(parts.second),
      weekday: WEEKDAY_CODES[parts.weekday] ?? 'SU',
    }
  } catch {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
      weekday: ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][date.getUTCDay()],
    }
  }
}

function timeZoneOffsetMs(date, timeZone) {
  const p = partsInZone(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - date.getTime()
}

function zonedMidnight(dateKey, timeZone) {
  const [year, month, day] = String(dateKey).split('-').map(Number)
  const wall = Date.UTC(year, month - 1, day)
  let guess = new Date(wall)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const next = new Date(wall - timeZoneOffsetMs(guess, timeZone))
    if (next.getTime() === guess.getTime()) break
    guess = next
  }
  return guess
}

export function zonedDayBounds(dateKey, timeZone = 'UTC') {
  const [year, month, day] = String(dateKey).split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  const nextKey = next.toISOString().slice(0, 10)
  return { start: zonedMidnight(dateKey, timeZone), end: zonedMidnight(nextKey, timeZone) }
}

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

function zonedWallTimeToDate(text, timeZone) {
  const match = String(text).match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?/)
  if (!match) return new Date(text)
  const [, year, month, day, hour, minute, second = '00'] = match
  const wall = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second)
  let guess = new Date(wall)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const next = new Date(wall - timeZoneOffsetMs(guess, timeZone))
    if (next.getTime() === guess.getTime()) break
    guess = next
  }
  return guess
}

function parseIcsDate(value, params = {}, timeZone = 'UTC') {
  const text = String(value ?? '').trim()
  if (/^\d{8}$/.test(text) || params.VALUE === 'DATE') {
    return {
      date: new Date(`${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T00:00:00Z`),
      allDay: true,
    }
  }
  if (text.endsWith('Z')) return { date: new Date(text), allDay: false }
  return {
    date: zonedWallTimeToDate(text, params.TZID || timeZone),
    allDay: false,
  }
}

function rruleMatches(rule, original, candidate, timeZone) {
  const frequency = rule.FREQ ?? ''
  const interval = Math.max(1, Number(rule.INTERVAL) || 1)
  const days = new Set((rule.BYDAY ?? '').split(',').filter(Boolean))
  const candidateParts = partsInZone(candidate, timeZone)
  const originalParts = partsInZone(original, timeZone)
  const dayDiff = Math.round((candidate - original) / DAY_MS)
  const monthDiff = (candidateParts.year - originalParts.year) * 12 + candidateParts.month - originalParts.month

  if (frequency === 'DAILY') return dayDiff % interval === 0 && (!days.size || days.has(candidateParts.weekday))
  if (frequency === 'WEEKLY') {
    if (days.size) return days.has(candidateParts.weekday) && Math.floor(dayDiff / 7) % interval === 0
    return candidateParts.weekday === originalParts.weekday && dayDiff % (7 * interval) === 0
  }
  if (frequency === 'MONTHLY') return candidateParts.day === originalParts.day && monthDiff % interval === 0
  if (frequency === 'YEARLY') {
    return (
      candidateParts.month === originalParts.month &&
      candidateParts.day === originalParts.day &&
      (candidateParts.year - originalParts.year) % interval === 0
    )
  }
  return false
}

function occurrencesFor(event, bounds, timeZone) {
  const original = parseIcsDate(event.start, event.params, timeZone)
  if (Number.isNaN(original.date.getTime())) return []
  const originalEnd = event.end ? parseIcsDate(event.end, event.params, timeZone).date : new Date(original.date.getTime() + 3_600_000)
  const duration = Math.max(0, originalEnd - original.date)
  if (!event.rrule) {
    return original.date <= bounds.end && originalEnd >= bounds.start
      ? [{ start: original.date, end: originalEnd, allDay: original.allDay }]
      : []
  }
  const rule = Object.fromEntries(
    String(event.rrule)
      .replace(/^RRULE:/i, '')
      .split(';')
      .filter(Boolean)
      .map((part) => part.split('=')),
  )
  const until = rule.UNTIL ? parseIcsDate(rule.UNTIL, {}, timeZone).date : null
  const count = Number(rule.COUNT) || Infinity
  const exdates = new Set(
    (event.exdates ?? []).map((item) => {
      const parts = partsInZone(parseIcsDate(item, {}, timeZone).date, timeZone)
      return `${parts.year}-${parts.month}-${parts.day}`
    }),
  )
  const found = []
  let seen = 0
  for (
    let cursor = new Date(original.date);
    cursor <= bounds.end && seen < 800;
    cursor = new Date(cursor.getTime() + DAY_MS)
  ) {
    if (until && cursor > until) break
    if (cursor < original.date || !rruleMatches(rule, original.date, cursor, timeZone)) continue
    seen += 1
    if (seen > count) break
    const parts = partsInZone(cursor, timeZone)
    const key = `${parts.year}-${parts.month}-${parts.day}`
    if (exdates.has(key)) continue
    const end = new Date(cursor.getTime() + duration)
    if (cursor <= bounds.end && end >= bounds.start) found.push({ start: cursor, end, allDay: original.allDay })
  }
  return found
}

export async function fetchIcsFeed({ url, date, source = 'Calendar', timeZone = 'UTC' }) {
  let target
  try {
    target = validateIcsUrl(url)
  } catch (error) {
    return { status: error.status ?? 400, body: { error: error.message, items: [] } }
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetchIcsSafely(target, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Briefr/1.0 (+https://briefr.app) Calendar reader',
        Accept: 'text/calendar, text/plain, */*',
      },
    })
    if (!response.ok) {
      return { status: 502, body: { error: `Calendar link could not be read (${response.status})`, items: [] } }
    }
    const text = await readCappedText(response, MAX_TEXT)
    if (text === null) return { status: 413, body: { error: 'Calendar feed too large', items: [] } }
    return { status: 200, body: { items: parseIcsFeed(text, { source, date, timeZone }) } }
  } catch (error) {
    const message = error.name === 'AbortError' ? 'Calendar link timed out' : error.message ?? 'Calendar link could not be read'
    return { status: error.status ?? 502, body: { error: message, items: [] } }
  } finally {
    clearTimeout(timeout)
  }
}

// Returns plain JSON-safe events for one local calendar day.
export function parseIcsFeed(text, { source = 'Calendar', date, timeZone = 'UTC' } = {}) {
  const bounds = zonedDayBounds(date, timeZone)
  const blocks = unfoldIcs(text)
    .join('\n')
    .split(/BEGIN:VEVENT/i)
    .slice(1)
    .map((block) => block.split(/END:VEVENT/i)[0])

  return blocks.flatMap((block, index) => {
    const fields = block.split('\n').map(parseLine).filter(Boolean)
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
    return occurrencesFor(event, bounds, timeZone).map((occurrence, occurrenceIndex) => ({
      id: `${String(source).toLowerCase()}-${event.uid}-${occurrenceIndex}`,
      source,
      title: event.title,
      start: occurrence.start.toISOString(),
      end: occurrence.end.toISOString(),
      allDay: occurrence.allDay,
      location: event.location,
      notes: get('DESCRIPTION')?.value ?? '',
      status: get('STATUS')?.value ?? '',
    }))
  })
}
