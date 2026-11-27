import './helpers.mjs'
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { resetStorage } from './helpers.mjs'

const { applyRateLimit, isDailyQuota, quotaSnapshot, runWithRotation } =
  await import('../src/lib/llmRotator.js')
const { parseJsonResponse } = await import('../src/lib/llmClient.js')
const { loadKeys, saveKeys } = await import('../src/lib/storage.js')

const baseKey = (id, provider = 'groq') => ({
  id,
  provider,
  apiKey: 'test-key',
  label: `Key ${id}`,
  baseUrl: provider === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' : 'https://api.groq.com/openai/v1',
  cooldownUntil: null,
  dailyExhausted: false,
  lastError: null,
})

const openAiReply = (content) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
  headers: new Headers(),
})
const geminiReply = (content) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: content }] } }] }),
  headers: new Headers(),
})
const errorReply = (status, text = '', headers = new Headers()) => ({
  ok: false,
  status,
  text: async () => text,
  headers,
})

beforeEach(() => {
  resetStorage()
  globalThis.fetch = async () => errorReply(500)
})

test('parseJsonResponse extracts plain and fenced JSON', () => {
  assert.deepEqual(parseJsonResponse('{"ok":true}'), { ok: true })
  assert.deepEqual(parseJsonResponse('```json\n{"ok":true}\n```'), { ok: true })
})

test('429 cooldown rotates to the next key and honors Retry-After', async () => {
  const first = baseKey('a')
  const second = baseKey('b')
  const before = Date.now()
  let call = 0
  globalThis.fetch = async () => {
    call += 1
    if (call === 1) return errorReply(429, 'rate_limit_exceeded', new Headers({ 'Retry-After': '2' }))
    return openAiReply(JSON.stringify({ ok: true, provider: 'b' }))
  }

  const result = await runWithRotation({ keys: [first, second], prompt: 'hello', cacheKey: null })
  assert.equal(result.data.provider, 'b')
  assert.ok(result.meta.rotatedCount >= 1)
  const stored = loadKeys()
  assert.equal(stored.find((key) => key.id === 'a').lastError, 'Rate limited (429)')
  assert.ok(stored.find((key) => key.id === 'a').cooldownUntil >= before + 1900)
})

test('daily-exhausted keys are skipped without a network call', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return openAiReply(JSON.stringify({ ok: true, provider: 'b' }))
  }
  const result = await runWithRotation({
    keys: [{ ...baseKey('a'), dailyExhausted: true }, baseKey('b')],
    prompt: 'hello',
    cacheKey: null,
  })
  assert.equal(result.data.provider, 'b')
  assert.equal(calls, 1)
})

test('auth and 5xx errors fall back across providers', async () => {
  const calls = []
  globalThis.fetch = async (_url, options) => {
    calls.push(String(_url))
    if (calls.length === 1) return errorReply(401, 'invalid api key')
    if (calls.length === 2) return errorReply(503, 'temporarily unavailable')
    if (calls.length === 3) return geminiReply(JSON.stringify({ ok: true, provider: 'gemini' }))
    return geminiReply(JSON.stringify({ ok: true, provider: 'gemini' }))
  }
  const result = await runWithRotation({
    keys: [baseKey('a', 'groq'), baseKey('g', 'gemini')],
    prompt: 'hello',
    cacheKey: null,
  })
  assert.equal(result.data.provider, 'gemini')
  assert.ok(calls.some((url) => url.includes('groq')))
  assert.ok(calls.some((url) => url.includes('googleapis')))
})

test('daily quota detection distinguishes per-minute limits', () => {
  assert.equal(isDailyQuota({ text: 'Quota exceeded for the day', headers: new Headers() }), true)
  assert.equal(isDailyQuota({ text: 'RESOURCE_EXHAUSTED', headers: new Headers() }), true)
  assert.equal(isDailyQuota({ text: 'rate_limit_exceeded', headers: new Headers() }), false)
})

test('applyRateLimit and quotaSnapshot describe key health', () => {
  const now = Date.now()
  const key = baseKey('q')
  assert.ok(applyRateLimit([key], 'q', { retryAfterSeconds: 60, now })[0].cooldownUntil >= now + 59_000)
  assert.equal(applyRateLimit([key], 'q', { daily: true, now })[0].dailyExhausted, true)

  const snapshot = quotaSnapshot(
    [key, { ...key, id: 'rest', cooldownUntil: now + 10_000 }, { ...key, id: 'dead', dailyExhausted: true }],
    now,
  )
  assert.deepEqual(
    [snapshot.total, snapshot.ready, snapshot.cooldown, snapshot.daily],
    [3, 1, 1, 1],
  )
  assert.equal(snapshot.exhausted, false)
  assert.ok(snapshot.nextCooldownSeconds > 0)
  saveKeys([{ ...key, dailyExhausted: true }])
})
