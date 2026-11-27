import { useState } from 'react'
import Modal from './Modal.jsx'
import {
  deleteAccount,
  exportAccountData,
  isCloudConfigured,
  refreshSession,
  resetPassword,
  sendMagicLink,
  signIn,
  signInWithOAuth,
  signOut,
  signUp,
  updatePassword,
} from '../lib/accountService.js'
import { continueLocalOnly } from '../lib/auth.js'

const inputClass = 'field min-h-12'

export default function AccountModal({ account, onChange, onClose, onDeleted }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const run = async (action, success) => {
    setBusy(true)
    setError('')
    try {
      const result = await action()
      if (success) await success(result)
    } catch (caught) {
      setError(caught.message)
    } finally {
      setBusy(false)
    }
  }

  const submit = (event) => {
    event.preventDefault()
    if (mode === 'magic') {
      run(() => sendMagicLink(email), () => setNotice('Check your email for a sign-in link.'))
      return
    }
    if (mode === 'reset') {
      run(() => resetPassword(email), () => setNotice('Password reset link sent. Check your email.'))
      return
    }
    if (mode === 'signup') {
      run(
        () => signUp({ email, password, name }),
        (result) => {
          if (result?.needsConfirmation) {
            setNotice('Check your email to confirm, then sign in.')
            return
          }
          onChange(result)
          setNotice('Your account is ready.')
        },
      )
      return
    }
    run(
      () => signIn({ email, password }),
      (result) => {
        if (result?.needsMagicLink) {
          setNotice('Check your email for a sign-in link.')
          return
        }
        onChange(result)
        setNotice('Welcome back.')
      },
    )
  }

  const downloadData = () => {
    try {
      const data = exportAccountData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `briefr-data-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      setNotice('Your data file is downloading. Secrets are hidden.')
    } catch (caught) {
      setError(caught.message)
    }
  }

  const removeAccount = () =>
    run(
      () => deleteAccount(),
      () => {
        onChange(null)
        onDeleted?.()
        setNotice('Account and local data removed.')
      },
    )

  return (
    <Modal
      label="Your account"
      title="Your account"
      description="Real accounts sync only non-secret settings. Keys stay on this device."
      size="sm"
      onClose={onClose}
    >
      <div>
        {!account ? (
          <form onSubmit={submit} className="space-y-3">
            <div className="flex gap-4 border-b border-[var(--line)]">
              {[
                ['signin', 'Sign in'],
                ['signup', 'Create account'],
                ['magic', 'Magic link'],
                ['reset', 'Reset password'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setMode(key)
                    setError('')
                  }}
                  aria-pressed={mode === key}
                  className={`-mb-px min-h-12 border-b-2 text-[0.8125rem] font-semibold ${
                    mode === key
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-transparent text-[var(--faint)] hover:text-[var(--ink)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === 'signup' && (
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" aria-label="Your name" />
            )}
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" aria-label="Email address" required />
            {(mode === 'signin' || mode === 'signup') && (
              <input
                className={inputClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (at least 8 characters)"
                aria-label="Password"
                required
                minLength={8}
              />
            )}

            {error && <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-[0.8125rem] text-[var(--danger)]">{error}</p>}
            {notice && <p className="rounded-lg bg-[var(--success-soft)] px-3 py-2 text-[0.8125rem] text-[var(--success)]">{notice}</p>}

            <button type="submit" disabled={busy} className="primary-button w-full disabled:opacity-50">
              {busy ? 'One moment…' : {
                signin: 'Sign in',
                signup: 'Create my account',
                magic: 'Email me a link',
                reset: 'Send reset link',
              }[mode]}
            </button>

            {isCloudConfigured && mode === 'signin' && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => signInWithOAuth({ provider: 'google' }),
                    () => setNotice('Continuing with Google…'),
                  )
                }
                className="quiet-button w-full"
              >
                Continue with Google
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const local = continueLocalOnly()
                onChange(local)
                setNotice('Local-only mode is on. Nothing leaves this device.')
              }}
              className="quiet-button w-full"
            >
              Use local-only mode
            </button>

            <p className="metadata">
              {isCloudConfigured
                ? 'Sign-in syncs preferences. Keys stay on this device.'
                : 'Cloud sign-in is not configured here. Local-only mode works right away.'}
            </p>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
              <div className="flex items-center gap-2">
                <span className="tnum flex size-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                  {(account.name || account.email || 'B').slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9375rem] font-semibold text-[var(--ink)]">{account.name || account.email}</p>
                  <p className="truncate text-[0.8125rem] text-[var(--muted)]">{account.email}</p>
                </div>
                <span className="metadata">{account.localOnly ? 'Local only' : 'Synced'}</span>
              </div>
            </div>

            {account.cloud && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => refreshSession(), (next) => { onChange(next); setNotice('Session refreshed.') })}
                  className="quiet-button w-full"
                >
                  Refresh session
                </button>
                <div className="space-y-2">
                  <label htmlFor="new-password" className="metadata">New password</label>
                  <input
                    id="new-password"
                    className={inputClass}
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                  />
                  <button
                    type="button"
                    disabled={busy || newPassword.length < 8}
                    onClick={() => run(() => updatePassword(newPassword), () => { setNewPassword(''); setNotice('Password updated.') })}
                    className="quiet-button w-full disabled:opacity-40"
                  >
                    Change password
                  </button>
                </div>
              </>
            )}

            <button type="button" onClick={downloadData} className="quiet-button w-full">Download my data</button>

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  () => signOut(),
                  () => {
                    onChange(null)
                    setNotice('Signed out.')
                  },
                )
              }
              className="quiet-button w-full"
            >
              Sign out
            </button>

            <div className="rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] p-4">
              <p className="text-[0.875rem] font-semibold text-[var(--danger)]">Delete account</p>
              <p className="mt-1 text-[0.8125rem] leading-snug text-[var(--danger)]">
                This removes your saved settings, keys, calendar links and cached briefings here. If you have a synced account, it also closes that account.
              </p>
              <button type="button" onClick={removeAccount} disabled={busy} className="danger-button mt-3 w-full">
                Delete account and data
              </button>
            </div>

            {error && <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-[0.8125rem] text-[var(--danger)]">{error}</p>}
            {notice && <p className="rounded-lg bg-[var(--success-soft)] px-3 py-2 text-[0.8125rem] text-[var(--success)]">{notice}</p>}
          </div>
        )}
      </div>
    </Modal>
  )
}
