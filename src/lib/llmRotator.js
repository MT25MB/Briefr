// Client-side multi-key rotation with cooldown, daily caps and same-day caching.
import { getCachedDigest, loadKeys, saveKeys, setCachedDigest, todayKey } from './storage.js'
import { parseJsonResponse, requestText } from './llmClient.js'

export const PROVIDER_CONFIG = {
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  },
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['openrouter/free', 'meta-llama/llama-3.3-70b-instruct:free', 'qwen/qwen3-4b:free'],
  },
  ollama: {
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434',
    models: ['llama3.1', 'qwen2.5'],
  },
}

export const COOLDOWN_MS = 65_000

function hash(value) {
  let result = 0
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(result).toString(36)
}

export function getKeyStatus(key, now = Date.now()) {
  if (key.lastError === 'Invalid API key') return 'invalid'
  if (key.dailyExhausted) return 'daily'
  if (Number(key.cooldownUntil) > now) return 'cooldown'
  return 'ready'
}

export function isKeyEligible(key, now = Date.now()) {
  return getKeyStatus(key, now) === 'ready'
}

export function nextEligibleKey(keys, now = Date.now()) {
  return keys.find((key) => isKeyEligible(key, now)) ?? null
}

export function markReady(keys, keyId) {
  return keys.map((key) =>
    key.id === keyId
      ? { ...key, cooldownUntil: null, dailyExhausted: false, lastError: null }
      : key,
  )
}

export function markInvalid(keys, keyId) {
  return keys.map((key) =>
    key.id === keyId ? { ...key, lastError: 'Invalid API key' } : key,
  )
}

export function applyRateLimit(keys, keyId, { daily = false, retryAfterSeconds = 0, now = Date.now() } = {}) {
  const waitMs = retryAfterSeconds
    ? Math.min(retryAfterSeconds * 1000, 15 * 60_000)
    : COOLDOWN_MS
  return keys.map((key) =>
    key.id === keyId
      ? {
          ...key,
          dailyExhausted: daily || Boolean(key.dailyExhausted),
          cooldownUntil: daily ? key.cooldownUntil : now + waitMs,
          lastError: daily ? 'Daily quota reached' : 'Rate limited (429)',
        }
      : key,
  )
}

export function isDailyQuota(response) {
  const body = String(response.text ?? '').toLowerCase()
  const retryAfter = Number(response.headers?.get?.('retry-after'))
  return (
    /daily quota|quota.*(per day|day|exceeded)|daily limit|resource_exhausted|reached.*(limit|quota)|free tier.*(limit|exhausted)|too many requests.*day/.test(body) ||
    retryAfter > 3600
  )
}

// A quiet summary the UI can show without exposing key material.
export function quotaSnapshot(keys = [], now = Date.now()) {
  const counts = { ready: 0, cooldown: 0, daily: 0, invalid: 0 }
  keys.forEach((key) => {
    counts[getKeyStatus(key, now)] += 1
  })
  const waits = keys
    .filter((key) => getKeyStatus(key, now) === 'cooldown')
    .map((key) => Math.max(1, Math.ceil((Number(key.cooldownUntil) - now) / 1000)))
  return {
    ...counts,
    total: keys.length,
    exhausted: keys.length > 0 && counts.ready === 0,
    nextCooldownSeconds: waits.length ? Math.min(...waits) : null,
  }
}

function isInvalidKey(response) {
  const body = String(response.text ?? '').toLowerCase()
  return (
    response.status === 401 ||
    response.status === 403 ||
    /api key not valid|invalid api key|unauthorized/.test(body)
  )
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

// Returns parsed JSON plus which key/model actually produced it.
export async function runWithRotation({
  keys,
  prompt,
  systemPrompt = '',
  forceRefresh = false,
  cacheKey,
  onKeysChange,
}) {
  // Pass cacheKey: null for private, one-off inputs such as pasted messages.
  const cacheId = cacheKey === null ? null : cacheKey ?? `${todayKey()}:${hash(prompt)}`
  if (!forceRefresh && cacheId) {
    const cached = getCachedDigest(cacheId)
    if (cached) {
      return { data: cached.data, meta: { ...cached.meta, cached: true, rotatedCount: 0 } }
    }
  }

  let workingKeys = keys.map((key) => ({ ...key }))
  let rotatedCount = 0
  let rotationNote = null
  const note = (text) => {
    rotationNote = text
  }
  const persist = () => {
    // Merge only status fields by key id: overlapping runs must not overwrite
    // each other's cooldown state from a stale snapshot.
    const stored = loadKeys()
    const merged = stored.map((key) => {
      const changed = workingKeys.find((item) => item.id === key.id)
      return changed
        ? {
            ...key,
            cooldownUntil: changed.cooldownUntil,
            dailyExhausted: changed.dailyExhausted,
            lastError: changed.lastError,
          }
        : key
    })
    for (const key of workingKeys) if (!merged.some((item) => item.id === key.id)) merged.push(key)
    saveKeys(merged)
    onKeysChange?.(merged.map((key) => ({ ...key })))
  }

  const finish = (text, key, model) => {
    let data
    try {
      data = parseJsonResponse(text)
    } catch {
      workingKeys = workingKeys.map((item) =>
        item.id === key.id ? { ...item, lastError: 'Invalid JSON response' } : item,
      )
      note(`${PROVIDER_CONFIG[key.provider]?.label ?? key.provider} sent an unexpected reply, so Briefr used a backup.`)
      rotatedCount += 1
      persist()
      return null
    }
    const meta = {
      provider: key.provider,
      model,
      keyLabel: key.label,
      rotatedCount,
      ...(rotationNote ? { rotationNote } : {}),
    }
    if (cacheId) {
      setCachedDigest(cacheId, {
        data,
        meta: { provider: key.provider, model, keyLabel: key.label },
        generatedAt: Date.now(),
      })
    }
    return { data, meta }
  }

  for (const key of workingKeys) {
    if (!isKeyEligible(key)) continue
    const config = PROVIDER_CONFIG[key.provider]
    if (!config) continue
    const models = key.model ? [key.model] : config.models
    const baseUrl = key.baseUrl || config.baseUrl

    for (const model of models) {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 12_000)
      let response
      try {
        response = await requestText(
          { ...key, baseUrl },
          { prompt, systemPrompt, model, signal: controller.signal },
        )
      } catch (error) {
        workingKeys = workingKeys.map((item) =>
          item.id === key.id ? { ...item, lastError: `Network error: ${error.message}` } : item,
        )
        note(`${PROVIDER_CONFIG[key.provider]?.label ?? key.provider} was unreachable, so Briefr used a backup. No action needed.`)
        rotatedCount += 1
        persist()
        break
      } finally {
        window.clearTimeout(timeout)
      }

      if (response.status >= 200 && response.status < 300) {
        const success = finish(response.text, key, model)
        if (success) return success
        break
      }

      if (response.status === 429) {
        const daily = isDailyQuota(response)
        const retryAfterSeconds = Number(response.headers?.get?.('retry-after')) || 0
        workingKeys = applyRateLimit(workingKeys, key.id, { daily, retryAfterSeconds })
        note(
          daily
            ? `${config.label} reached its daily limit, so Briefr moved to the next available key.`
            : `${config.label} hit a brief rate limit, so Briefr tried the next model or key.`,
        )
        rotatedCount += 1
        persist()
        if (daily) break // whole key is out for the day
        continue // try this key's next model
      }

      if (isInvalidKey(response)) {
        workingKeys = markInvalid(workingKeys, key.id)
        note(
          response.status === 403
            ? `${config.label} key doesn't have access, so Briefr moved to the next key.`
            : `${config.label} key wasn't accepted, so Briefr moved to the next key.`,
        )
        rotatedCount += 1
        persist()
        break
      }

      if ([502, 503, 504].includes(response.status)) {
        await sleep(700)
        // The first request's abort timer is already cleared; the retry needs
        // its own deadline or a stalled provider can hang the whole run.
        const retryController = new AbortController()
        const retryTimeout = window.setTimeout(() => retryController.abort(), 12_000)
        try {
          const retry = await requestText(
            { ...key, baseUrl },
            { prompt, systemPrompt, model, signal: retryController.signal },
          )
          if (retry.status >= 200 && retry.status < 300) {
            const success = finish(retry.text, key, model)
            if (success) return success
            break
          }
          response = retry
        } catch {
          // fall through to rotation
        } finally {
          window.clearTimeout(retryTimeout)
        }
      }

      workingKeys = workingKeys.map((item) =>
        item.id === key.id ? { ...item, lastError: `Provider error (${response.status})` } : item,
      )
      if (!rotationNote) note(`${config.label} was briefly unavailable, so Briefr used a backup.`)
      rotatedCount += 1
      persist()
      break
    }
  }

  throw new Error('No eligible AI key or model succeeded')
}

// Lightweight single-key check used by the key manager.
export async function pingKey(key) {
  const started = Date.now()
  const config = PROVIDER_CONFIG[key.provider]
  if (!config) return { ok: false, message: 'Unsupported provider', key }
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await requestText(
      { ...key, baseUrl: key.baseUrl || config.baseUrl },
      {
        prompt: 'Reply with the word OK.',
        systemPrompt: 'Return only the word OK.',
        model: key.model || config.models[0],
        signal: controller.signal,
      },
    )
    let updated = key
    if (response.status >= 200 && response.status < 300) {
      updated = { ...key, cooldownUntil: null, dailyExhausted: false, lastError: null }
      return {
        ok: true,
        latencyMs: Date.now() - started,
        message: `${config.label} responded (${key.model || config.models[0]}).`,
        key: updated,
      }
    }
    if (response.status === 429) {
      updated = applyRateLimit([key], key.id, { daily: isDailyQuota(response) })[0]
      return { ok: false, message: `Rate limited (${response.status})`, key: updated }
    }
    if (isInvalidKey(response)) {
      updated = markInvalid([key], key.id)[0]
      return { ok: false, message: 'Invalid API key', key: updated }
    }
    return { ok: false, message: `Provider error (${response.status})`, key: { ...key, lastError: `Provider error (${response.status})` } }
  } catch (error) {
    return { ok: false, message: `Network error: ${error.message}`, key: { ...key, lastError: 'Network error' } }
  } finally {
    window.clearTimeout(timeout)
  }
}
