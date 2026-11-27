import { useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import Modal from './Modal.jsx'
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

  const footer = <button type="button" onClick={onClose} className="primary-button">Close calendars</button>

  return (
    <Modal
      label="Connect calendars"
      title="Connect your calendars"
      description="Briefr reads today's events into your morning view. You can skip this."
      onClose={onClose}
      footer={footer}
    >
      <div className="space-y-3">
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
                className="inline-flex min-h-12 items-center gap-1.5 rounded-lg bg-[var(--accent-action)] px-3 text-[0.8125rem] font-semibold text-white hover:bg-[var(--accent-action-hover)]"
              >
                Connect Google
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
              className="inline-flex min-h-12 items-center gap-1.5 rounded-lg bg-[var(--accent-action)] px-3 text-[0.8125rem] font-semibold text-white hover:bg-[var(--accent-action-hover)]"
            >
              Save Notion database
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
              Connect with Notion OAuth
            </button>
          </Section>

          <Section
            title="Apple or Proton calendar link"
            note="Use a read-only ICS/iCalendar link. Proton works best this way because there's no public third-party API."
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
              className="inline-flex min-h-12 items-center gap-1.5 rounded-lg bg-[var(--accent-action)] px-3 text-[0.8125rem] font-semibold text-white hover:bg-[var(--accent-action-hover)]"
            >
              Add calendar link
            </button>
            {(connections.ics ?? []).map((feed) => (
              <div key={feed.id} className="flex items-center gap-2 rounded-lg bg-[var(--surface)] px-2.5 py-2">
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
              Save CalDAV proxy
            </button>
          </Section>

          <p className="metadata">Connections stay on this device.</p>
          <p className="metadata">Recurring events expand into today's local time. Add a proxy URL if a feed blocks browser requests.</p>
          {notice && (
            <p className="flex items-start gap-1.5 rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-[0.8125rem] text-[var(--warning)]">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {notice}
            </p>
          )}
      </div>
    </Modal>
  )
}
