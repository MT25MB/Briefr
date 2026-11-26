// Tiny local session store. No cookies, no server, no secrets in bundles.
const SESSION_KEY = 'briefr_session'
const SESSION_DAYS = 30

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session?.accountId || (session.expiresAt ?? 0) < Date.now()) return null
    return session
  } catch {
    return null
  }
}

export function getActiveAccountId() {
  return getSession()?.accountId ?? ''
}

export function setSession(accountId) {
  const expiresAt = Date.now() + SESSION_DAYS * 86_400_000
  localStorage.setItem(SESSION_KEY, JSON.stringify({ accountId, expiresAt }))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
