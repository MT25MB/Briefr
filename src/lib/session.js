// Tiny local mirror of the active auth session. No secrets are stored here.
const SESSION_KEY = 'briefr_session'

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session?.accountId) return null
    if (session.expiresAt && session.expiresAt < Date.now()) return null
    return session
  } catch {
    return null
  }
}

export function getActiveAccountId() {
  return getSession()?.accountId ?? ''
}

export function setSession(accountId, meta = {}) {
  const session = {
    accountId,
    email: meta.email ?? '',
    name: meta.name ?? '',
    localOnly: Boolean(meta.localOnly),
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
