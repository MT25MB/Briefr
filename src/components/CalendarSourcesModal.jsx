import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Info, Link2, Lock, Plus, Trash2, X } from 'lucide-react'
import { startGoogleOAuthPkce, startNotionOAuth } from '../lib/calendarService.js'

function Section({ title, note, children }) {
  return (
    <div className="border-t border-[var(--line)] pt-5">
      <p className="text-[0.875rem] font-semibold text-[var(--ink)]">{title}</p>
      {note && <p className="mt-1 text-[0.8125rem] leading-snug text-[var(--muted)]">{note}</p>}
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[0.8125rem] text-[var(--ink)] placeholder:text-[var(--faint)] focus:border-[var(--accent-line)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]'

export default function CalendarSourcesModal({ connections, onChange, onClose }) {
  const [googleClientId, setGoogleClientId] = useState(connections.google?.clientId ?? '')
  const [notionToken, setNotionToken] = useState('')
  const [notionDatabaseId, setNotionDatabaseId] = useState(connections.notion?.databaseId ?? '')
  const [notionClientId, setNotionClientId] = useState(connections.notion?.clientId ?? '')
  const [notionRedirect, setNotionRedirect] = useState(connections.notion?.redirectUri ?? '')
  const [notionProxy, setNotionProxy] = useState(connections.notion?.proxyUrl ?? '')
  const [icsLabel, setIcsLabel] = useState('Apple')
  const [icsUrl, setIcsUrl] = useState('')
  const [icsProxy, setIcsProxy] = useState('')
  const [caldavProxy, setCaldavProxy] = useState(connections.caldav?.proxyUrl ?? '')
  const [caldavUrl, setCaldavUrl] = useState(connections.caldav?.calendarUrl ?? '')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const save = (patch) => onChange({ ...connections, ...patch })

  const run = (action) => {
    try {
      action()
    } catch (error) {
      setNotice(error.message)
    }
  }

  const addIcs = () => {
    if (!icsUrl.trim()) return
    save({
      ics: [...(connections.ics ?? []), { id: `ics_${Date.now()}`, source: icsLabel, url: icsUrl.trim(), proxyUrl: icsProxy.trim() }],
    })
    setIcsUrl('')
    setNotice(`${icsLabel} calendar link added.`)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(28,27,25,0.5)] p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Connect calendars"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white "
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line-soft)] px-5 py-4 sm:px-7">
          <div>
            <h2 className="text-[1.0625rem] font-bold tracking-tight text-[var(--ink)]">Connect your calendars</h2>
            <p className="text-[0.8125rem] text-[var(--muted)]">
              Briefr reads today's events and puts them in your morning view. You can skip this.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close calendars"
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg text-[var(--faint)] hover:bg-[var(--paper)] hover:text-[var(--ink)]"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[var(--paper)] px-5 py-5 sm:px-7">
          <Section
            title="Google Calendar"
            note="Read-only access to titles, times and locations. Nothing gets changed."
          >
            <input
              className={inputClass}
              value={googleClientId}
              onChange={(event) => setGoogleClientId(event.target.value)}
              placeholder="Your Google OAuth client ID"
              aria-label="Google OAuth client ID"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => run(() => {
                  save({ google: { ...connections.google, clientId: googleClientId } })
                  startGoogleOAuthPkce({ clientId: googleClientId })
                })}
                className="inline-flex min-h-12 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-[0.8125rem] font-semibold text-white hover:bg-[var(--accent-hover)]"
              >
                <Link2 size={12} /> Connect Google
              </button>
              {connections.google?.token && <span className="metadata">Connected</span>}
              {connections.google?.token && (
                <button
                  type="button"
                  onClick={() => save({ google: { ...connections.google, token: null } })}
                  className="text-[0.8125rem] font-semibold text-[var(--danger)] hover:underline"
                >
                  Disconnect
                </button>
              )}
            </div>
          </Section>

          <Section
            title="Notion"
            note="Point Briefr at a database with a Date property. Done and archived entries are skipped."
          >
            <input
              type="password"
              className={inputClass}
              value={notionToken}
              onChange={(event) => setNotionToken(event.target.value)}
              placeholder="Integration token (secret or ntnc_...)"
              aria-label="Notion integration token"
            />
            <input
              className={inputClass}
              value={notionDatabaseId}
              onChange={(event) => setNotionDatabaseId(event.target.value)}
              placeholder="Database ID"
              aria-label="Notion database ID"
            />
            <button
              type="button"
              onClick={() => {
                save({ notion: { ...connections.notion, token: notionToken, databaseId: notionDatabaseId } })
                setNotice('Notion database saved.')
              }}
              className="inline-flex min-h-12 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-[0.8125rem] font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              <Check size={12} /> Save Notion database
            </button>
            <p className="text-[0.75rem] leading-snug text-[var(--faint)]">
              OAuth needs a small proxy to keep the Notion client secret off your device. Add one if you use OAuth.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <input className={inputClass} value={notionClientId} onChange={(e) => setNotionClientId(e.target.value)} placeholder="OAuth client ID" aria-label="Notion OAuth client ID" />
              <input className={inputClass} value={notionRedirect} onChange={(e) => setNotionRedirect(e.target.value)} placeholder="Redirect URL" aria-label="Notion redirect URL" />
              <input className={inputClass} value={notionProxy} onChange={(e) => setNotionProxy(e.target.value)} placeholder="Token proxy URL" aria-label="Notion token proxy URL" />
            </div>
            <button
              type="button"
              onClick={() => run(() => {
                save({ notion: { ...connections.notion, clientId: notionClientId, redirectUri: notionRedirect, proxyUrl: notionProxy } })
                startNotionOAuth({ clientId: notionClientId, redirectUri: notionRedirect })
              })}
              className="inline-flex min-h-12 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-[0.8125rem] font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              <Link2 size={12} /> Connect with Notion OAuth
            </button>
          </Section>

          <Section
            title="Apple or Proton calendar link"
            note="Use a read-only ICS/iCalendar link. Proton works best this way — there's no public third-party API."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                className={inputClass}
                value={icsLabel}
                onChange={(event) => setIcsLabel(event.target.value)}
                aria-label="Calendar source"
              >
                <option value="Apple">Apple</option>
                <option value="Proton">Proton</option>
              </select>
              <input
                className={inputClass}
                value={icsUrl}
                onChange={(event) => setIcsUrl(event.target.value)}
                placeholder="https://.../calendar.ics"
                aria-label="Calendar feed URL"
              />
            </div>
            <input
              className={inputClass}
              value={icsProxy}
              onChange={(event) => setIcsProxy(event.target.value)}
              placeholder="Proxy URL (optional, if the feed blocks browsers)"
              aria-label="Calendar feed proxy URL"
            />
            <button
              type="button"
              onClick={addIcs}
              className="inline-flex min-h-12 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-[0.8125rem] font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              <Plus size={12} /> Add calendar link
            </button>
            {(connections.ics ?? []).map((feed) => (
              <div key={feed.id} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2">
                <span className="metadata">{feed.source}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[0.75rem] text-[var(--muted)]">{feed.url}</span>
                <button
                  type="button"
                  onClick={() => save({ ics: connections.ics.filter((item) => item.id !== feed.id) })}
                  aria-label={`Remove ${feed.source} calendar link`}
                  className="text-[var(--faint)] hover:text-[var(--danger)]"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </Section>

          <Section
            title="Apple iCloud through a CalDAV proxy"
            note="Optional. iCloud usually needs a small proxy that can talk CalDAV for you; Briefr sends it your calendar address and reads today's events."
          >
            <input
              className={inputClass}
              value={caldavProxy}
              onChange={(event) => setCaldavProxy(event.target.value)}
              placeholder="Proxy URL"
              aria-label="CalDAV proxy URL"
            />
            <input
              className={inputClass}
              value={caldavUrl}
              onChange={(event) => setCaldavUrl(event.target.value)}
              placeholder="CalDAV calendar URL"
              aria-label="CalDAV calendar URL"
            />
            <button
              type="button"
              onClick={() => {
                save({ caldav: { proxyUrl: caldavProxy, calendarUrl: caldavUrl } })
                setNotice('Apple CalDAV proxy saved.')
              }}
              className="inline-flex min-h-12 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-[0.8125rem] font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              <Check size={12} /> Save CalDAV proxy
            </button>
          </Section>

          <p className="flex items-start gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-[0.75rem] leading-snug text-[var(--muted)]">
            <Lock size={11} className="mt-0.5 shrink-0 text-[var(--accent)]" />
            Calendar tokens and links stay in this browser's local storage. Briefr has no server that keeps them.
          </p>
          <p className="flex items-start gap-1.5 px-1 text-[0.75rem] leading-snug text-[var(--faint)]">
            <Info size={11} className="mt-0.5 shrink-0" />
            Recurring events are expanded into today's local time. If a feed blocks browser requests, add a proxy URL.
          </p>
          {notice && (
            <p className="flex items-start gap-1.5 rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-[0.8125rem] text-[var(--warning)]">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {notice}
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-[var(--line-soft)] bg-[var(--paper)] px-5 py-3.5 sm:px-7">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-lg bg-[var(--ink)] px-4 py-2 text-[0.8125rem] font-semibold text-white hover:bg-[var(--ink-2)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
