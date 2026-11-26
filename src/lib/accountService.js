// Local accounts with PBKDF2 password hashing. $0 hosting, no backend, no secrets in bundles.
// This protects a shared device; it is not a cloud identity across devices.
import { clearSession, getSession, setSession } from './session.js'
import { copyAnonymousDataToScope, scopeKey, wipeScope } from './storage.js'

const ACCOUNTS_KEY = 'briefr_accounts'
const ITERATIONS = 180_000

function readAccounts() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

function randomHex(bytes = 16) {
  const values = new Uint8Array(bytes)
  crypto.getRandomValues(values)
  return [...values].map((value) => value.toString(16).padStart(2, '0')).join('')
}

function toBase64(buffer) {
  const values = new Uint8Array(buffer)
  let binary = ''
  values.forEach((value) => {
    binary += String.fromCharCode(value)
  })
  return btoa(binary)
}

function fromBase64(value) {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function derive(password, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromBase64(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    256,
  )
  return toBase64(bits)
}

function constantTimeEqual(a = '', b = '') {
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return difference === 0
}

function publicAccount(account) {
  if (!account) return null
  return { id: account.id, email: account.email, name: account.name, createdAt: account.createdAt }
}

export function getCurrentAccount() {
  const session = getSession()
  if (!session) return null
  return publicAccount(readAccounts()[session.accountId])
}

function validate(email, password) {
  const normalized = String(email ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Enter a valid email address.')
  if (String(password ?? '').length < 8) throw new Error('Use a password with at least 8 characters.')
  return normalized
}

export async function signUp({ email, password, name = '' }) {
  const normalized = validate(email, password)
  const accounts = readAccounts()
  const existing = Object.values(accounts).find((account) => account.email === normalized)
  if (existing) throw new Error('That email already has an account here. Try signing in.')
  const id = `user_${randomHex(12)}`
  const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)))
  accounts[id] = {
    id,
    email: normalized,
    name: String(name).trim().slice(0, 60),
    createdAt: new Date().toISOString(),
    salt,
    verifier: await derive(password, salt),
  }
  writeAccounts(accounts)
  copyAnonymousDataToScope(id)
  setSession(id)
  return publicAccount(accounts[id])
}

export async function signIn({ email, password }) {
  const normalized = String(email ?? '').trim().toLowerCase()
  const accounts = readAccounts()
  const account = Object.values(accounts).find((item) => item.email === normalized)
  if (!account) throw new Error('No account found for that email.')
  if (!constantTimeEqual(account.verifier, await derive(password, account.salt))) {
    throw new Error('That password does not match.')
  }
  setSession(account.id)
  return publicAccount(account)
}

export function signOut() {
  clearSession()
}

export async function deleteAccount({ password }) {
  const account = getCurrentAccount()
  if (!account) throw new Error('You are not signed in.')
  const stored = readAccounts()[account.id]
  if (!constantTimeEqual(stored.verifier, await derive(password, stored.salt))) {
    throw new Error('That password does not match.')
  }
  const accounts = readAccounts()
  delete accounts[account.id]
  writeAccounts(accounts)
  wipeScope(account.id)
  clearSession()
}

export function exportAccountData({ includeSecrets = false } = {}) {
  const account = getCurrentAccount()
  if (!account) throw new Error('You are not signed in.')
  const read = (key) => {
    try {
      return JSON.parse(localStorage.getItem(scopeKey(key)) ?? 'null')
    } catch {
      return null
    }
  }
  const calendars = read('briefr_calendars') ?? {}
  const safeCalendars = includeSecrets
    ? calendars
    : {
        ...calendars,
        google: { ...calendars.google, token: calendars.google?.token ? '[hidden]' : null },
        notion: { ...calendars.notion, token: calendars.notion?.token ? '[hidden]' : null },
      }
  const keys = read('briefr_keys') ?? []
  return {
    exportedAt: new Date().toISOString(),
    account: { email: account.email, name: account.name },
    preferences: read('briefr_prefs'),
    calendars: safeCalendars,
    keys: includeSecrets ? keys : keys.map((key) => ({ ...key, apiKey: '[hidden]' })),
    cachedDigests: read('briefr_digest_cache'),
    note: 'API keys and calendar tokens are hidden by default. This file stays on your device.',
  }
}
