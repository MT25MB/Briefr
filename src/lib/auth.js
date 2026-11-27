// One auth interface for two modes: Supabase cloud or a first-class local guest.
// Only publishable env values are used. Never put a service-role key in VITE_*.
import { clearSession, getSession as getStoredSession, setSession } from './session.js'
import { copyAnonymousDataToScope } from './storage.js'

const URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isCloudConfigured = Boolean(URL && ANON_KEY)
const AUTH_EVENT = 'briefr:auth'

let clientPromise = null

function getClient() {
  if (!isCloudConfigured) return Promise.resolve(null)
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(URL, ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }),
    )
  }
  return clientPromise
}

export async function getSupabase() {
  return getClient()
}

function asAccount(user) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email ?? '',
    name: user.user_metadata?.name ?? '',
    cloud: true,
    localOnly: false,
  }
}

function redirectTo() {
  return typeof window === 'undefined' ? '' : window.location.origin + window.location.pathname
}

function emit(account) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: account }))
}

function mirror(account) {
  if (account) setSession(account.id, account)
  else clearSession()
  emit(account)
}

export function getCurrentAccount() {
  const session = getStoredSession()
  if (!session) return null
  return {
    id: session.accountId,
    email: session.email ?? '',
    name: session.name ?? '',
    cloud: !session.localOnly,
    localOnly: Boolean(session.localOnly),
  }
}

export function isLocalOnly() {
  return Boolean(getStoredSession()?.localOnly)
}

// ---------- Shared interface ----------

/** Returns the normalized account for the active mode, or null. */
export async function getSession() {
  const client = await getClient()
  if (!client) return getCurrentAccount()
  const { data } = await client.auth.getSession()
  return asAccount(data?.session?.user) ?? getCurrentAccount()
}

export async function signUp({ email, password, name = '' }) {
  const client = await getClient()
  if (!client) throw new Error('Cloud sign-in is not configured here. Use local-only mode.')
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { name }, emailRedirectTo: redirectTo() },
  })
  if (error) throw new Error(error.message)
  const account = asAccount(data.user)
  if (data.session) mirror(account)
  return {
    ...(account ?? { email, name, cloud: true, localOnly: false }),
    needsConfirmation: !data.session,
  }
}

/** Password when provided; otherwise a real Supabase magic link. */
export async function signIn({ email, password = '' } = {}) {
  const client = await getClient()
  if (!client) throw new Error('Cloud sign-in is not configured here. Use local-only mode.')
  if (!password) return sendMagicLink(email)

  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  const account = asAccount(data.user)
  mirror(account)
  return account
}

export async function sendMagicLink(email) {
  const client = await getClient()
  if (!client) throw new Error('Magic links need cloud sign-in to be configured.')
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo() },
  })
  if (error) throw new Error(error.message)
  return { email, needsMagicLink: true, cloud: true, localOnly: false }
}

export async function signInWithOAuth({ provider = 'google', scopes = '' } = {}) {
  const client = await getClient()
  if (!client) throw new Error('OAuth needs cloud sign-in to be configured.')
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectTo(),
      ...(scopes ? { scopes } : {}),
    },
  })
  if (error) throw new Error(error.message)
  return { provider, pending: true }
}

export async function resetPassword(email) {
  const client = await getClient()
  if (!client) throw new Error('Password reset needs cloud sign-in to be configured.')
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo(),
  })
  if (error) throw new Error(error.message)
  return { email, sent: true }
}

export async function updatePassword(password) {
  const client = await getClient()
  if (!client) throw new Error('Password changes need a cloud account.')
  const { data, error } = await client.auth.updateUser({ password })
  if (error) throw new Error(error.message)
  return asAccount(data.user) ?? getCurrentAccount()
}

export async function refreshSession() {
  const client = await getClient()
  if (!client) return getCurrentAccount()
  const { data, error } = await client.auth.refreshSession()
  if (error) throw new Error(error.message)
  const account = asAccount(data?.session?.user)
  mirror(account)
  return account
}

export async function signOut() {
  const client = await getClient()
  if (client) {
    const { error } = await client.auth.signOut()
    if (error) throw new Error(error.message)
  }
  mirror(null)
  return null
}

/**
 * Subscribe to auth changes in both modes. Returns an unsubscribe function.
 * Cloud uses Supabase's realtime auth event; local uses a storage/custom event.
 */
export async function onAuthStateChange(callback) {
  const client = await getClient()
  if (client) {
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const account = asAccount(session?.user)
      mirror(account)
      callback(account)
    })
    return () => data?.subscription?.unsubscribe?.()
  }

  const handler = (event) => {
    const detail = event instanceof CustomEvent ? event.detail : null
    callback(detail ?? getCurrentAccount())
  }
  window.addEventListener(AUTH_EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(AUTH_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

/** Full local-only auth implementation using the same interface. */
export const LocalOnlyGuest = {
  mode: 'local',
  getSession: async () => getCurrentAccount(),
  signIn: async () => {
    throw new Error('Local-only mode has no sign-in. Use a cloud account to sync.')
  },
  signUp: async () => {
    throw new Error('Local-only mode has no sign-up. Use a cloud account to sync.')
  },
  signOut: async () => {
    mirror(null)
    return null
  },
  onAuthStateChange: async (callback) => {
    const handler = (event) => callback(event instanceof CustomEvent ? event.detail : null)
    window.addEventListener(AUTH_EVENT, handler)
    return () => window.removeEventListener(AUTH_EVENT, handler)
  },
  refreshSession: async () => getCurrentAccount(),
}

export const auth = {
  mode: isCloudConfigured ? 'cloud' : 'local',
  getSession,
  signIn,
  signUp,
  signOut,
  onAuthStateChange,
  refreshSession,
  sendMagicLink,
  signInWithOAuth,
  resetPassword,
  updatePassword,
}

// ---------- App bootstrap and legacy aliases ----------

export async function bootstrapAuth() {
  const client = await getClient()
  if (!client) return getCurrentAccount()
  const { data } = await client.auth.getSession()
  const account = asAccount(data?.session?.user)
  mirror(account)
  return account ?? getCurrentAccount()
}

export function continueLocalOnly() {
  setSession('local', { email: 'This device', name: 'This device', localOnly: true })
  copyAnonymousDataToScope('local')
  const account = getCurrentAccount()
  emit(account)
  return account
}

export async function deleteAccount() {
  const client = await getClient()
  if (!client) {
    mirror(null)
    return
  }
  const { error } = await client.rpc('delete_own_account')
  if (error) throw new Error(error.message)
  mirror(null)
}

// Existing call sites use onAuthChange; the shared name is onAuthStateChange.
export const onAuthChange = onAuthStateChange
