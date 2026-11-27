import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateIcsUrl } from '../api/icsShared.js'

const edge = readFileSync('functions/api/ics.js', 'utf8')
const service = readFileSync('src/lib/calendarService.js', 'utf8')
const schedule = readFileSync('src/lib/schedule.js', 'utf8')
const mockDigest = readFileSync('src/lib/mockDigest.js', 'utf8')

// Edge function: GET only, private responses, no public edge cache, no logging.
assert.match(edge, /export const onRequestGet/)
assert.match(edge, /Cache-Control': 'no-store'/)
assert.doesNotMatch(edge, /public, max-age|s-maxage/)
assert.doesNotMatch(edge, /console\.(log|info|warn|error)/)
assert.match(service, /validateIcsUrl/)
assert.match(service, /fetchIcsDirect/)
assert.match(service, /validateIcsUrl\(url\)/)

// SSRF protection covers https-only plus loopback/private/link-local.
assert.throws(() => validateIcsUrl('http://example.com/cal.ics'), /https/)
assert.throws(() => validateIcsUrl('https://localhost/cal.ics'), /Private|localhost/)
assert.throws(() => validateIcsUrl('https://127.0.0.1/cal.ics'), /Private/)
assert.throws(() => validateIcsUrl('https://169.254.169.254/latest'), /Private/)
assert.equal(validateIcsUrl('https://cal.example.com/private.ics').protocol, 'https:')

// No mock schedule arrays in production paths.
assert.doesNotMatch(mockDigest, /mockCalendarEvents/)
assert.doesNotMatch(mockDigest, /schedule: \[/)

// Pagination and real adapters.
assert.match(service, /nextPageToken/)
assert.match(service, /start_cursor/)
assert.match(service, /overlapsLocalDay/)
assert.match(service, /Tags: \$\{tags\}/)
assert.match(schedule, /gapMinutes < 20/)

const date = '2026-11-26'
const calls = []
globalThis.fetch = async (url, options) => {
  calls.push(String(url))
  const body = JSON.parse(options?.body ?? '{}')
  if (String(url).includes('googleapis.com')) {
    const page = String(url).includes('pageToken=next-page') ? 2 : 1
    return {
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: `g${page}`,
            summary: `Google event ${page}`,
            start: { dateTime: `${date}T0${page}:00:00` },
            end: { dateTime: `${date}T0${page}:30:00` },
            status: 'confirmed',
            location: 'Room A',
          },
        ],
        ...(page === 1 ? { nextPageToken: 'next-page' } : {}),
      }),
    }
  }
  if (String(url).includes('/v1/databases/') && !String(url).includes('/query')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        properties: {
          Name: { type: 'title' },
          When: { type: 'date' },
          State: { type: 'status' },
          Topic: { type: 'multi_select' },
        },
      }),
    }
  }
  if (String(url).includes('/databases/') && String(url).includes('/query')) {
    const page = body.start_cursor ? 2 : 1
    return {
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            id: `n${page}`,
            properties: {
              Name: { title: [{ plain_text: `Notion event ${page}` }] },
              When: { date: { start: `${date}T1${page}:00:00`, end: `${date}T1${page}:30:00` } },
              State: { status: { name: 'Planned' } },
              Topic: { multi_select: [{ name: 'Work' }] },
            },
          },
        ],
        ...(page === 1 ? { has_more: true, next_cursor: 'cursor-2' } : {}),
      }),
    }
  }
  throw new Error(`Unexpected URL: ${url}`)
}

const { fetchGoogleEvents, fetchNotionEvents } = await import('../src/lib/calendarService.js')
const google = await fetchGoogleEvents({ token: 'token', date })
assert.equal(google.length, 2)
assert.equal(google[0].title, 'Google event 1')
assert.equal(google[1].source, 'Google')

const notion = await fetchNotionEvents({ token: 'token', databaseId: 'db', date })
assert.equal(notion.length, 2)
assert.equal(notion[0].source, 'Notion')
assert.match(notion[0].notes, /Tags: Work/)

console.log('Milestone 12 verified: edge SSRF/cache, adapters with pagination, recurrence, no mock schedule.')
