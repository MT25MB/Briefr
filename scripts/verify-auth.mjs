import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const auth = read('src/lib/auth.js')
const db = read('src/lib/db.js')
const sql = read('supabase/migrations/001_init.sql')
const panel = read('src/components/PrivacyPanel.jsx')
const account = read('src/components/AccountModal.jsx')

for (const name of [
  'getSession',
  'signIn',
  'signUp',
  'signOut',
  'onAuthStateChange',
  'refreshSession',
  'sendMagicLink',
  'signInWithOAuth',
  'resetPassword',
  'updatePassword',
]) {
  assert.match(auth, new RegExp(`export (async )?function ${name}\\b|${name}:`), `auth.js missing ${name}`)
}

assert.match(auth, /export const LocalOnlyGuest/)
assert.match(auth, /onAuthStateChange: async/)
assert.match(auth, /signInWithOtp/)
assert.match(auth, /signInWithOAuth/)
assert.match(auth, /refreshSession\(\)/)
assert.match(auth, /resetPasswordForEmail/)
assert.match(auth, /auth\.updateUser\(\{ password \}\)/)

for (const table of ['user_profiles', 'user_preferences', 'calendar_sources', 'triage_items']) {
  assert.match(sql, new RegExp(`create table if not exists public\\.${table}`), `missing ${table}`)
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`), `RLS missing on ${table}`)
  for (const action of ['select', 'insert', 'update', 'delete']) {
    assert.match(
      sql,
      new RegExp(`on public\\.${table} for ${action}`),
      `missing ${action} policy on ${table}`,
    )
  }
}
assert.ok(
  (sql.match(/references auth\.users\(id\) on delete cascade/g) ?? []).length >= 4,
  'missing cascade foreign keys',
)

assert.match(sql, /delete_own_account/)
assert.doesNotMatch(sql, /api_key|apiKey|access_token/i)
assert.match(db, /publicCalendarConfig/)
assert.match(db, /calendarRows/)
assert.match(db, /saveCloudTriage/)

for (const label of [
  'Account, security & privacy',
  'Active storage mode',
  'Connected sources',
  'Clear local cache & keys',
  'Export JSON',
  'Delete account & data',
]) {
  assert.ok(panel.includes(label), `PrivacyPanel missing ${label}`)
}

for (const label of ['Magic link', 'Continue with Google', 'Reset password', 'Refresh session', 'Change password']) {
  assert.ok(account.includes(label), `AccountModal missing ${label}`)
}

console.log('Milestone 10 verified: auth interface, local guest, RLS schema, secret hygiene, privacy UI.')
