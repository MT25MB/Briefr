import './helpers.mjs'
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { resetStorage } from './helpers.mjs'

const { getTodaysEvents, normalizeEvent, parseIcs } = await import('../src/lib/calendarService.js')
const { gapNote, prepareSchedule } = await import('../src/lib/schedule.js')

const feed = (events) => ['BEGIN:VCALENDAR', ...events, 'END:VCALENDAR'].join('\r\n')
const vevent = (lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT']
const date = '2026-11-27'

beforeEach(resetStorage)

test('parseIcs unfolds lines and keeps all-day events on the local day', () => {
  const text = feed(
    vevent([
      'UID:all-1',
      'DTSTART;VALUE=DATE:20261127',
      'DTEND;VALUE=DATE:20261128',
      'SUMMARY:A very long',
      '  folded title',
    ]),
  )
  const events = parseIcs(text, 'Apple', date)
  assert.equal(events.length, 1)
  assert.equal(events[0].title, 'A very long folded title')
  assert.equal(events[0].isAllDay, true)
  assert.match(events[0].startTime, /2026-11-27/)
})

test('parseIcs includes a multi-day event that spans today', () => {
  const text = feed(
    vevent([
      'UID:span-1',
      'DTSTART;VALUE=DATE:20261126',
      'DTEND;VALUE=DATE:20261129',
      'SUMMARY:Trip',
    ]),
  )
  assert.equal(parseIcs(text, 'Apple', date).length, 1)
})

test('parseIcs expands a daily recurrence onto today', () => {
  const text = feed(
    vevent([
      'UID:repeat-1',
      `DTSTART:${date.replaceAll('-', '')}T090000`,
      `DTEND:${date.replaceAll('-', '')}T093000`,
      'RRULE:FREQ=DAILY;COUNT=3',
      'SUMMARY:Standup',
    ]),
  )
  const events = parseIcs(text, 'Apple', date)
  assert.equal(events.length, 1)
  assert.equal(events[0].title, 'Standup')
})

test('getTodaysEvents groups all-day first and sorts timed events', async () => {
  localStorage.setItem(
    'briefr_quick_events',
    JSON.stringify([
      { id: 'late', title: 'Late', source: 'Quick add', startTime: `${date}T15:00:00`, endTime: `${date}T15:30:00` },
      { id: 'holiday', title: 'Holiday', source: 'Quick add', startTime: `${date}T00:00:00`, isAllDay: true },
      { id: 'early', title: 'Early', source: 'Quick add', startTime: `${date}T09:00:00`, endTime: `${date}T09:30:00` },
    ]),
  )
  const result = await getTodaysEvents({}, date)
  assert.deepEqual(result.events.map((event) => event.title), ['Holiday', 'Early', 'Late'])
  assert.equal(result.events[1].source, 'Quick add')
})

test('gapNote detects overlaps, back-to-back, and tight transitions', () => {
  const event = (title, start, end, location = 'Room A') =>
    normalizeEvent({ id: title, title, startTime: `${date}T${start}:00`, endTime: `${date}T${end}:00`, location })
  const first = event('First', '09:00', '10:00')
  assert.match(gapNote(event('Overlap', '09:30', '10:00'), first), /Overlaps/)
  assert.match(gapNote(event('Back to back', '10:05', '11:00'), first), /Back-to-back/)
  assert.match(
    gapNote(normalizeEvent({
      id: 'switch', title: 'Switch', startTime: `${date}T10:10:00`, endTime: `${date}T11:00:00`, location: 'Room B',
    }), first),
    /Tight switch/,
  )
  assert.equal(gapNote(event('Roomy', '10:30', '11:00'), first), '')
})

test('prepareSchedule picks the next event after now', () => {
  const events = [
    normalizeEvent({ id: 'past', title: 'Past', startTime: `${date}T08:00:00`, endTime: `${date}T08:30:00` }),
    normalizeEvent({ id: 'next', title: 'Next', startTime: `${date}T12:00:00`, endTime: `${date}T12:30:00` }),
  ]
  const plan = prepareSchedule(events, new Date(`${date}T10:00:00`))
  assert.equal(plan.upNext.title, 'Next')
  assert.equal(plan.current, null)
})
