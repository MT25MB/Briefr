// Supabase Auth when configured, otherwise a clear local-only mode.
// Only publishable env values are used here. Never put a service-role key in VITE_*.
import { clearSession, getSession, setSession } from './session.js'
import { copyAnonymousDataToScope } from './storage.js'

const URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isCloudConfigured = Boolean(URL && ANON_KEY)

let clientPromise = null

function getClient() {
  if (!isCloudConfigured) return Promise.resolve(null)
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(URL, ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
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

function mirror(account) {
  if (account) setSession(account.id, account)
  else clearSession()
}

export function getCurrentAccount() {
  const session = getSession()
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
  return Boolean(getSession()?.localOnly)
}

export async function bootstrapAuth() {
  const client = await getClient()
  if (!client) return getCurrentAccount()
  const { data } = await client.auth.getSession()
  const account = asAccount(data?.session?.user)
  mirror(account)
  return account ?? getCurrentAccount()
}

export async function onAuthChange(callback) {
  const client = await getClient()
  if (!client) return () => {}
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    const account = asAccount(session?.user)
    mirror(account)
    callback(account)
  })
  return () => data?.subscription?.unsubscribe?.()
}

export async function signUp({ email, password, name = '' }) {
  const client = await getClient()
  if (!client) throw new Error('Cloud sign-in is not set up here. Use local-only mode.')
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })
  if (error) throw new Error(error.message)
  const account = asAccount(data.user)
  if (data.session) mirror(account)
  return {
    ...(account ?? { email, name }),
    needsConfirmation: !data.session,
  }
}

export async function signIn({ email, password }) {
  const client = await getClient()
  if (!client) throw new Error('Cloud sign-in is not set up here. Use local-only mode.')
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  const account = asAccount(data.user)
  mirror(account)
  return account
}

export async function signOut() {
  const client = await getClient()
  if (client) await client.auth.signOut()
  clearSession()
}

export function continueLocalOnly() {
  setSession('local', { email: '', name: 'This device', localOnly: true })
  copyAnonymousDataToScope('local')
  return getCurrentAccount()
}

export async function deleteAccount() {
  const client = await getClient()
  if (!client) {
    clearSession()
    return
  }
  const { error } = await client.rpc('delete_own_account')
  if (error) throw new Error(error.message)
  clearSession()
}
