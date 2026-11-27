import './helpers.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resetStorage } from './helpers.mjs'

const { splitMessages } = await import('../src/lib/triageService.js')
const { newsCacheKey } = await import('../src/lib/storage.js')
const { fetchCaldavEvents } = await import('../src/lib/calendarService.js')

test('a single email body with a time is not split as a chat message', () => {
  const paste = ['From: Dana', 'Please call at 10:30 AM and confirm by noon.'].join('\n')
  assert.equal(splitMessages(paste).length, 1)
})

test('news cache key changes when the underlying stories change', () => {
  const base = { location: 'Brooklyn', tone: 'Friendly', topics: ['Local'], feeds: ['https://a/feed'], politicalLens: 'neutral', coverageMode: 'balanced', date: '2026-11-27' }
  const first = newsCacheKey({ ...base, storyKey: 'https://a/1|Fri, 27 Nov 2026 08:00:00 GMT' })
  const second = newsCacheKey({ ...base, storyKey: 'https://a/2|Fri, 27 Nov 2026 09:00:00 GMT' })
  assert.notEqual(first, second)
})

test('calendar proxies over cleartext http are rejected', async () => {
  resetStorage()
  let called = false
  globalThis.fetch = async () => {
    called = true
    return { ok: true, status: 200, headers: new Headers({ 'Content-Type': 'text/calendar' }), text: async () => 'BEGIN:VCALENDAR\r\nEND:VCALENDAR' }
  }
  await assert.rejects(
    () => fetchCaldavEvents({ proxyUrl: 'http://proxy.example/caldav', calendarUrl: 'https://cal.example/private.ics', date: '2026-11-27' }),
    /HTTPS|https/i,
  )
  assert.equal(called, false, 'no request should be sent to a cleartext proxy')
})
