import './helpers.mjs'
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { resetStorage } from './helpers.mjs'

const {
  clearTriage,
  loadTriage,
  setTriageItemDone,
  splitMessages,
  triageMessages,
} = await import('../src/lib/triageService.js')

const date = '2026-11-27'

beforeEach(resetStorage)

test('fallback with no keys categorizes an action item', async () => {
  const result = await triageMessages({
    rawText: 'From: Dana\nPlease approve invoice #2048 by noon.',
    keys: [],
    date,
  })
  assert.equal(result.source, 'rules')
  assert.equal(result.needsAction.length, 1)
  assert.equal(result.needsAction[0].sender, 'Dana')
  assert.equal(result.fyi.length, 0)
  assert.equal(result.noiseItems.length, 0)
})

test('fallback categorizes FYI and newsletter items', async () => {
  const info = await triageMessages({ rawText: 'From: Sam\nThe release shipped on time.', keys: [], date })
  assert.equal(info.fyi.length, 1)
  assert.equal(info.needsAction.length, 0)

  const promo = await triageMessages({
    rawText: 'Weekly newsletter: 20% off everything. Unsubscribe anytime.',
    keys: [],
    date,
  })
  assert.equal(promo.noiseItems.length, 1)
  assert.equal(promo.noiseCount, 1)
  assert.equal(promo.needsAction.length, 0)
})

test('multi-message paste is split and each message is sorted', async () => {
  const paste = [
    'From: Dana',
    'Please approve invoice #2048 by noon.',
    '',
    '---',
    '',
    '[10:32 AM] Maya: Need a headcount by Friday, please.',
    '',
    'Dana  11:05 AM',
    'Weekly newsletter: 20% off everything. Unsubscribe anytime.',
  ].join('\n')
  assert.equal(splitMessages(paste).length, 3)

  const result = await triageMessages({ rawText: paste, keys: [], date })
  assert.equal(result.needsAction.length, 2)
  assert.equal(result.noiseItems.length, 1)
  assert.equal(result.noiseCount, 1)
})

test('completed actions persist and can be cleared for a new day', async () => {
  await triageMessages({ rawText: 'From: Dana\nPlease reply today.', keys: [], date })
  const stored = loadTriage(date)
  const updated = setTriageItemDone(stored, stored.needsAction[0].id)
  assert.equal(updated.needsAction[0].done, true)
  assert.equal(loadTriage(date).needsAction[0].done, true)
  assert.equal(loadTriage('2026-11-28').needsAction.length, 0)
  assert.equal(clearTriage(date).needsAction.length, 0)
})
