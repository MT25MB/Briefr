import assert from 'node:assert/strict'

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

const { buildTriagePrompt, triageLocally } = await import('../src/lib/prompts.js')
const {
  emptyTriage,
  loadTriage,
  saveTriage,
  setTriageItemDone,
  clearTriage,
  normalizeTriageResult,
  triageMessages,
} = await import('../src/lib/triageService.js')

const date = '2026-11-26'
const prompt = buildTriagePrompt({
  text: 'From Dana: please approve invoice #2048 by noon',
  tone: 'Direct',
})
assert.match(prompt, /"needsAction"/)
assert.match(prompt, /"fyi"/)
assert.match(prompt, /"noiseCount"/)
assert.match(prompt, /"noiseItems"/)
assert.match(prompt, /WRITING TONE: Direct/)
assert.match(prompt, /suggestedAction/)

const schedule = [{
  id: 'standup', title: 'Team standup', startTime: `${date}T09:00:00`,
  endTime: `${date}T09:30:00`, isAllDay: false, location: 'Zoom', source: 'Google', status: '', notes: '',
}]
const action = triageLocally('From Dana:\nPlease approve invoice #2048 by noon.', schedule)
assert.equal(action.needsAction.length, 1)
assert.equal(action.fyi.length, 0)
assert.equal(action.noiseItems.length, 0)
assert.equal(action.noiseCount, 0)
assert.equal(action.needsAction[0].sender, 'Dana')
assert.equal(action.needsAction[0].urgency, 'by noon')
assert.match(action.needsAction[0].scheduleNote, /Before 9:00 AM Team standup/)

const promo = triageLocally('Weekly newsletter: 20% off everything. Unsubscribe anytime.')
assert.equal(promo.noiseItems.length, 1)
assert.equal(promo.noiseCount, 1)
assert.equal(promo.needsAction.length, 0)

const normalized = normalizeTriageResult(action, { source: 'ai', date })
assert.equal(normalized.source, 'ai')
assert.equal(normalized.needsAction[0].done, false)
assert.equal(normalized.noiseCount, 0)
assert.ok(normalized.needsAction[0].id)

assert.deepEqual(loadTriage(date), emptyTriage(date))
saveTriage(normalized)
assert.equal(loadTriage(date).needsAction.length, 1)
const done = setTriageItemDone(loadTriage(date), normalized.needsAction[0].id)
assert.equal(done.needsAction[0].done, true)
assert.equal(loadTriage('2026-11-27').needsAction.length, 0)
assert.equal(clearTriage(date).needsAction.length, 0)
assert.equal(loadTriage(date).noiseItems.length, 0)

// Legacy noise arrays still migrate into the new shape.
store.set('briefr_triage', JSON.stringify({
  dateKey: date, source: 'rules', needsAction: [], fyi: [],
  noise: [{ id: 'old', sender: 'Promo', summary: 'Weekly deals' }],
}))
assert.equal(loadTriage(date).noiseCount, 1)
assert.equal(loadTriage(date).noiseItems[0].sender, 'Promo')
clearTriage(date)

const key = {
  id: 'key_test',
  provider: 'groq',
  apiKey: 'test',
  label: 'Test key',
  baseUrl: 'https://api.groq.com/openai/v1',
  cooldownUntil: null,
  dailyExhausted: false,
  lastError: null,
}
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          needsAction: [{ sender: 'Alex', summary: 'RSVP needed', suggestedAction: 'Send RSVP', urgency: 'by Friday', scheduleNote: 'Before 9:00 AM Team standup' }],
          fyi: [],
          noiseCount: 0,
          noiseItems: [],
        }),
      },
    }],
  }),
  headers: new Headers(),
})
const ai = await triageMessages({
  rawText: 'From Alex: please RSVP by Friday',
  todayEvents: schedule,
  tone: 'Friendly',
  keys: [key],
  date,
})
assert.equal(ai.source, 'ai')
assert.equal(ai.needsAction[0].sender, 'Alex')
assert.equal(ai.needsAction[0].urgency, 'by Friday')
assert.equal(ai.needsAction[0].scheduleNote, 'Before 9:00 AM Team standup')

// A 429 must still produce a usable deterministic result, not an error screen.
const limitedKey = { ...key, id: 'key_limited' }
globalThis.fetch = async () => ({
  ok: false,
  status: 429,
  text: async () => 'rate limit reached',
  headers: new Headers({ 'Retry-After': '30' }),
})
const limited = await triageMessages({
  rawText: 'From Dana: approve the invoice by noon',
  todayEvents: schedule,
  keys: [limitedKey],
  date,
})
assert.equal(limited.source, 'rules')
assert.equal(limited.needsAction.length, 1)
assert.equal(limited.needsAction[0].sender, 'Dana')

console.log('Triage pipeline verified: strict contract, fallback, 429 recovery, daily state, AI route.')
