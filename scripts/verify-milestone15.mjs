import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const store = new Map()
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
}
globalThis.window = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
}

const { parseIcsFeed } = await import('../api/icsShared.js')
const feed = (events) => ['BEGIN:VCALENDAR', ...events, 'END:VCALENDAR'].join('\r\n')
const event = (lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT']

// Folded lines, all-day dates, and multi-day spans.
const folded = feed([
  ...event([
    'UID:fold-1',
    'DTSTART;VALUE=DATE:20261127',
    'DTEND;VALUE=DATE:20261128',
    'SUMMARY:A very long',
    '  folded title',
  ]),
])
const foldedItems = parseIcsFeed(folded, { source: 'Apple', date: '2026-11-27', timeZone: 'UTC' })
assert.equal(foldedItems.length, 1)
assert.equal(foldedItems[0].allDay, true)
assert.equal(foldedItems[0].title, 'A very long folded title')

const spanning = feed([
  ...event([
    'UID:span-1',
    'DTSTART;VALUE=DATE:20261126',
    'DTEND;VALUE=DATE:20261129',
    'SUMMARY:Three day trip',
  ]),
])
assert.equal(
  parseIcsFeed(spanning, { source: 'Apple', date: '2026-11-27', timeZone: 'UTC' }).length,
  1,
)

// TZID timed event lands on the right local hour.
const zoned = feed([
  ...event([
    'UID:zone-1',
    'DTSTART;TZID=America/New_York:20261127T090000',
    'DTEND;TZID=America/New_York:20261127T093000',
    'SUMMARY:Standup',
  ]),
])
const zonedItems = parseIcsFeed(zoned, {
  source: 'Apple',
  date: '2026-11-27',
  timeZone: 'America/New_York',
})
assert.equal(zonedItems.length, 1)
const hourInZone = (iso, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  return Number(parts.find((part) => part.type === 'hour').value) % 24
}
assert.equal(hourInZone(zonedItems[0].start, 'America/New_York'), 9)

// Daily recurrence across a spring-forward DST change stays at 9 AM local.
const dst = feed([
  ...event([
    'UID:dst-1',
    'DTSTART;TZID=America/New_York:20260307T090000',
    'DTEND;TZID=America/New_York:20260307T093000',
    'RRULE:FREQ=DAILY;COUNT=5',
    'SUMMARY:Daily standup',
  ]),
])
const dstItems = parseIcsFeed(dst, {
  source: 'Apple',
  date: '2026-03-08',
  timeZone: 'America/New_York',
})
assert.equal(dstItems.length, 1)
assert.equal(hourInZone(dstItems[0].start, 'America/New_York'), 9)

// EXDATE removes the matching timed occurrence.
const excluded = feed([
  ...event([
    'UID:ex-1',
    'DTSTART:20261125T090000Z',
    'DTEND:20261125T093000Z',
    'RRULE:FREQ=DAILY;COUNT=3',
    'EXDATE:20261127T090000Z',
    'SUMMARY:Daily standup',
  ]),
])
assert.equal(
  parseIcsFeed(excluded, { source: 'Apple', date: '2026-11-27', timeZone: 'UTC' }).length,
  0,
)

// Weekly BYDAY occurrence lands on today's local date.
const weekly = feed([
  ...event([
    'UID:week-1',
    'DTSTART;VALUE=DATE:20261120',
    'DTEND;VALUE=DATE:20261121',
    'RRULE:FREQ=WEEKLY;BYDAY=FR;COUNT=3',
    'SUMMARY:Friday review',
  ]),
])
assert.equal(
  parseIcsFeed(weekly, { source: 'Apple', date: '2026-11-27', timeZone: 'UTC' }).length,
  1,
)

// Multi-message split and persistence.
const { splitMessages, triageMessages, loadTriage, setTriageItemDone, clearTriage } =
  await import('../src/lib/triageService.js')
const paste = [
  'From: Dana',
  'Subject: Invoice',
  'Please approve invoice #2048 by noon.',
  '',
  '---',
  '',
  '[10:32 AM] Maya: Need a headcount by Friday, please.',
  '',
  'Dana  11:05 AM',
  'Weekly newsletter: 20% off everything. Unsubscribe anytime.',
].join('\n')
const messages = splitMessages(paste)
assert.equal(messages.length, 3)
assert.match(messages[0], /invoice #2048/)
assert.match(messages[1], /headcount/)
assert.match(messages[2], /newsletter/)

const result = await triageMessages({ rawText: paste, date: '2026-11-27' })
assert.equal(result.needsAction.length, 2)
assert.equal(result.noiseItems.length, 1)
assert.equal(result.noiseCount, 1)
const saved = loadTriage('2026-11-27')
assert.equal(saved.needsAction.length, 2)
const done = setTriageItemDone(saved, saved.needsAction[0].id)
assert.equal(done.needsAction[0].done, true)
assert.equal(loadTriage('2026-11-27').needsAction[0].done, true)
assert.equal(clearTriage('2026-11-27').needsAction.length, 0)

// Source guidance is exported and rendered.
const { CALENDAR_SOURCE_GUIDES } = await import('../src/lib/calendarService.js')
assert.deepEqual(
  CALENDAR_SOURCE_GUIDES.map((guide) => guide.id),
  ['google', 'notion', 'apple', 'proton'],
)
assert.match(CALENDAR_SOURCE_GUIDES[0].limit, /Read-only events/)
assert.match(CALENDAR_SOURCE_GUIDES[1].instructions, /Date property/)
assert.match(CALENDAR_SOURCE_GUIDES[2].instructions, /ICS/)
assert.match(CALENDAR_SOURCE_GUIDES[3].instructions, /Proton/)
assert.match(read('src/components/CalendarSourcesModal.jsx'), /CALENDAR_SOURCE_GUIDES/)
assert.match(read('src/components/TriageCard.jsx'), /Clear Triage/)
assert.match(read('src/components/TriageCard.jsx'), /Copy checklist/)
assert.match(read('src/components/ScheduleCard.jsx'), /read-only calendar link/)

console.log('Milestone 15 verified: ICS edge cases, source guides, multi-message triage, persisted actions.')
