import { useState } from 'react'
import Modal from './Modal.jsx'
import { deleteAccount, exportAccountData, signIn, signOut, signUp } from '../lib/accountService.js'
import { continueLocalOnly, isCloudConfigured } from '../lib/auth.js'

const inputClass =
  'w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[0.875rem] text-[var(--ink)] placeholder:text-[var(--faint)] focus:border-[var(--accent-line)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]'

export default function AccountModal({ account, onChange, onClose, onDeleted }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = mode === 'signup'
        ? await signUp({ email, password, name })
        : await signIn({ email, password })
      if (result?.needsConfirmation) {
        setNotice('Check your email to confirm, then sign in.')
        return
      }
      onChange(result)
      setNotice(mode === 'signup' ? 'Your account is ready.' : 'Welcome back.')
    } catch (caught) {
      setError(caught.message)
    } finally {
      setBusy(false)
    }
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

  const removeAccount = async () => {
    setBusy(true)
    setError('')
    try {
      await deleteAccount()
      onChange(null)
      onDeleted?.()
      setNotice('Account and local data removed.')
    } catch (caught) {
      setError(caught.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      label="Your account"
      title="Your account"
      description="Keeps each person's settings and calendars separate on this device."
      size="sm"
      onClose={onClose}
    >
      <div>
          {!account ? (
            <form onSubmit={submit} className="space-y-3">
              <div className="flex gap-2 rounded-xl bg-[var(--line-soft)] p-1">
                {['signin', 'signup'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setMode(item)
                      setError('')
                    }}
                    className={`min-h-12 flex-1 rounded-lg px-3 text-[0.8125rem] font-semibold transition-colors ${
                      mode === item ? 'bg-[var(--surface)] text-[var(--ink)] ' : 'text-[var(--muted)]'
                    }`}
                  >
                    {item === 'signin' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>

              {mode === 'signup' && (
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" aria-label="Your name" />
              )}
              <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" aria-label="Email address" required />
              <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (at least 8 characters)" aria-label="Password" required />

              {error && <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-[0.8125rem] text-[var(--danger)]">{error}</p>}
              {notice && <p className="rounded-lg bg-[var(--success-soft)] px-3 py-2 text-[0.8125rem] text-[var(--success)]">{notice}</p>}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-action)] px-3 text-[0.875rem] font-semibold text-white hover:bg-[var(--accent-action-hover)] disabled:opacity-50"
              >
                {busy ? 'One moment…' : mode === 'signup' ? 'Create my account' : 'Sign in'}
              </button>

              <button
                type="button"
                onClick={() => {
                  const local = continueLocalOnly()
                  onChange(local)
                  setNotice('Local-only mode is on. Nothing leaves this device.')
                }}
                className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-[0.875rem] font-semibold text-[var(--ink-2)] hover:bg-[var(--paper)]"
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

              <button
                type="button"
                onClick={downloadData}
                className="inline-flex min-h-12 w-full items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-[0.8125rem] font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
              >
                Download my data
              </button>

              <button
                type="button"
                onClick={() => {
                  signOut()
                  onChange(null)
                  setNotice('Signed out.')
                }}
                className="inline-flex min-h-12 w-full items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-[0.8125rem] font-semibold text-[var(--ink-2)] hover:bg-[var(--paper)]"
              >
                Sign out
              </button>

              <div className="rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] p-4">
                <p className="text-[0.875rem] font-semibold text-[var(--danger)]">Delete account</p>
                <p className="mt-1 text-[0.8125rem] leading-snug text-[var(--danger)]">
                  This removes your saved settings, keys, calendar links and cached briefings here. If you have a synced account, it also closes that account.
                </p>
                <button
                  type="button"
                  onClick={removeAccount}
                  disabled={busy}
                  className="mt-3 inline-flex min-h-12 items-center gap-1.5 rounded-lg bg-[var(--danger-action)] px-3 text-[0.8125rem] font-semibold text-white hover:bg-[var(--danger-action)] disabled:opacity-40"
                >
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
