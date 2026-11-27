import assert from 'node:assert/strict'
import { parseIcsFeed } from '../api/icsShared.js'
import { normalizeEvent } from '../src/lib/calendarService.js'
import { prepareSchedule, gapNote } from '../src/lib/schedule.js'
import { buildWeatherOutfitPrompt } from '../src/lib/prompts.js'
import { buildBriefingScript } from '../src/lib/audioBriefing.js'

const date = '2026-11-26'
const timeZone = 'America/New_York'
const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:daily-standup
DTSTART;TZID=America/New_York:20261126T090000
DTEND;TZID=America/New_York:20261126T093000
RRULE:FREQ=DAILY;COUNT=3
SUMMARY:Daily standup
LOCATION:Zoom
DESCRIPTION:Bring the sprint board
END:VEVENT
BEGIN:VEVENT
UID:all-day
DTSTART;VALUE=DATE:20261126
DTEND;VALUE=DATE:20261127
SUMMARY:Conference
END:VEVENT
END:VCALENDAR`

const parsed = parseIcsFeed(ics, { source: 'Apple', date, timeZone })
assert.equal(parsed.length, 2)
const normalized = parsed.map((item) => normalizeEvent(item))
assert.deepEqual(Object.keys(normalized[0]).sort(), [
  'endTime', 'id', 'isAllDay', 'location', 'notes', 'source', 'startTime', 'status', 'title',
])
assert.equal(normalized[0].title, 'Daily standup')
assert.equal(normalized[0].notes, 'Bring the sprint board')
assert.equal(normalized[1].isAllDay, true)

const base = (id, start, end, extra = {}) => normalizeEvent({
  id, title: id, startTime: start, endTime: end, source: 'Google', ...extra,
})
const now = new Date(`${date}T08:45:00`)
const events = [
  base('All-day retreat', `${date}T00:00:00`, `${date}T23:59:00`, { isAllDay: true }),
  base('Standup', `${date}T09:00:00`, `${date}T09:30:00`, { location: 'Zoom' }),
  base('Review', `${date}T09:35:00`, `${date}T10:00:00`, { location: 'Studio B' }),
  base('Overlap', `${date}T09:20:00`, `${date}T09:50:00`, { location: 'Studio B' }),
]
const plan = prepareSchedule(events, now)
assert.equal(plan.allDay.length, 1)
assert.equal(plan.timed.length, 3)
assert.equal(plan.upNext.id, 'Standup')
assert.match(gapNote(events[2], events[1]), /Tight switch|Back-to-back|Only/)
assert.match(gapNote(events[3], events[1]), /Overlaps/)

const prompt = buildWeatherOutfitPrompt({
  weatherSummary: { temp: 50 },
  preferences: {},
  schedule: normalized,
})
assert.match(prompt, /startTime/)
assert.match(prompt, /prep detail/)
const script = buildBriefingScript({
  dateLabel: date,
  weather: { current: { temp: 50, feelsLike: 48, condition: 'Clear' }, locationLabel: 'Brooklyn', windows: [] },
  wardrobe: { wardrobeTimeline: [], precipAlert: 'Dry.' },
  schedule: normalized,
})
assert.match(script, /Daily standup at/)
console.log('Schedule pipeline verified: schema, recurrence, friction, prompt, audio.')
