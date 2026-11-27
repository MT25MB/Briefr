// Inbox triage: pasted text becomes a strict, daily action list.
// Pasted text itself is never written to localStorage — only derived items.
import { readJson, todayKey, writeJson } from './storage.js'
import { runWithRotation } from './llmRotator.js'
import { buildTriagePrompt, triageLocally } from './prompts.js'

const TRIAGE_KEY = 'briefr_triage'
const MAX_ITEMS = 12

export function emptyTriage(date = todayKey()) {
  return {
    dateKey: date,
    source: 'empty',
    needsAction: [],
    fyi: [],
    noiseCount: 0,
    noiseItems: [],
  }
}

export function loadTriage(date = todayKey()) {
  const stored = readJson(TRIAGE_KEY, null)
  if (!stored || stored.dateKey !== date) return emptyTriage(date)
  const noiseItems = stored.noiseItems ?? stored.noise ?? []
  return {
    dateKey: date,
    source: stored.source ?? 'rules',
    needsAction: stored.needsAction ?? [],
    fyi: stored.fyi ?? [],
    noiseCount: typeof stored.noiseCount === 'number' ? stored.noiseCount : noiseItems.length,
    noiseItems,
  }
}

export function saveTriage(triage) {
  const noiseItems = triage.noiseItems ?? triage.noise ?? []
  const saved = {
    dateKey: triage.dateKey ?? todayKey(),
    source: triage.source ?? 'rules',
    needsAction: triage.needsAction ?? [],
    fyi: triage.fyi ?? [],
    noiseCount: typeof triage.noiseCount === 'number' ? triage.noiseCount : noiseItems.length,
    noiseItems,
  }
  writeJson(TRIAGE_KEY, saved)
  return saved
}

export function clearTriage(date = todayKey()) {
  const cleared = emptyTriage(date)
  saveTriage(cleared)
  return cleared
}

const text = (value, limit = 240) => String(value ?? '').trim().slice(0, limit)
const itemId = (prefix, index, label = '') =>
  `${prefix}-${index}-${label.replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'item'}`

function normalizeList(list = [], group) {
  if (!Array.isArray(list)) return []
  return list.slice(0, MAX_ITEMS).map((entry, index) => {
    const sender = text(entry.sender ?? entry.from ?? entry.name ?? '')
    const summary = text(entry.summary ?? entry.description ?? entry.message ?? '')
    const base = { id: itemId(group, index, sender || summary), sender, summary }
    if (group === 'needsAction') {
      return {
        ...base,
        suggestedAction: text(entry.suggestedAction ?? entry.nextStep ?? 'Reply or handle this today.'),
        urgency: text(entry.urgency ?? entry.due ?? entry.deadline ?? '', 80),
        scheduleNote: text(entry.scheduleNote ?? '', 160),
        done: false,
      }
    }
    return base
  }).filter((item) => item.sender || item.summary)
}

// LLM output and the deterministic fallback both land here.
export function normalizeTriageResult(data = {}, { source = 'rules', date = todayKey() } = {}) {
  const noiseItems = normalizeList(data.noiseItems ?? data.noise, 'noise')
  return {
    dateKey: date,
    source,
    needsAction: normalizeList(data.needsAction, 'needsAction'),
    fyi: normalizeList(data.fyi, 'fyi'),
    noiseCount: typeof data.noiseCount === 'number' ? data.noiseCount : noiseItems.length,
    noiseItems,
  }
}

export function setTriageItemDone(triage, id, done = true) {
  const next = {
    ...triage,
    needsAction: triage.needsAction.map((item) => (item.id === id ? { ...item, done } : item)),
  }
  return saveTriage(next)
}

/**
 * Sort raw pasted text into needsAction / fyi / noise, grounded in today's events.
 * Keeps working with no keys, with rate limits, or with an invalid model reply.
 */
export async function triageMessages({
  rawText = '',
  text: legacyText = '',
  todayEvents = [],
  schedule = todayEvents,
  tone = 'Quick Bullets',
  keys = [],
  date = todayKey(),
} = {}) {
  const input = String(rawText || legacyText || '').trim()
  if (!input) return emptyTriage(date)

  const fallback = () =>
    normalizeTriageResult(triageLocally(input, schedule, tone), { source: 'rules', date })

  if (!keys.length) return saveTriage(fallback())

  try {
    const { data } = await runWithRotation({
      keys,
      prompt: buildTriagePrompt({ text: input, schedule: todayEvents, tone }),
      systemPrompt: 'You are Briefr, a calm inbox assistant. Return strict JSON only, no commentary.',
      forceRefresh: true,
      cacheKey: null,
    })
    return saveTriage(normalizeTriageResult(data, { source: 'ai', date }))
  } catch {
    // 429, invalid key, network error, or malformed JSON — never a dead end.
    return saveTriage(fallback())
  }
}

// Backwards-compatible alias for older call sites.
export const triageMessage = triageMessages
