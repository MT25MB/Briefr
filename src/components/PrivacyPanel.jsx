import { Database, Download, Lock, ShieldCheck, Trash2, X } from 'lucide-react'

function Row({ label, detail, onDisconnect, disconnectLabel = 'Disconnect' }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--paper)] px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] font-semibold text-[var(--ink-2)]">{label}</p>
        {detail && <p className="mt-0.5 text-[0.75rem] leading-snug text-[var(--faint)]">{detail}</p>}
      </div>
      {onDisconnect && (
        <button
          type="button"
          onClick={onDisconnect}
          className="inline-flex min-h-12 items-center gap-1 rounded-lg border border-[var(--line)] px-2 text-[0.75rem] font-semibold text-[var(--danger)] hover:bg-white"
        >
          <X size={11} /> {disconnectLabel}
        </button>
      )}
    </div>
  )
}

export default function PrivacyPanel({
  connections = {},
  keyCount = 0,
  prefs = {},
  account,
  onDisconnectGoogle,
  onDisconnectNotion,
  onDisconnectIcs,
  onDisconnectCaldav,
  onClearCache,
  onExportData,
  onDeleteData,
  onWipeLocalData,
}) {
  const ics = connections.ics ?? []

  return (
    <div className="border-t border-[var(--line)] pt-5">
      <p className="flex items-center gap-1.5 text-[0.875rem] font-semibold text-[var(--ink)]">
        <ShieldCheck size={13} className="text-[var(--accent)]" /> Privacy & data
      </p>
      <p className="mt-1 text-[0.8125rem] leading-snug text-[var(--muted)]">
        Here's exactly what Briefr can see. Nothing is sent to a Briefr server — there isn't one.
      </p>

      <div className="mt-3 space-y-1.5">
        <Row
          label="Google Calendar"
          detail={connections.google?.token ? 'Read-only: event titles, times and locations.' : 'Not connected.'}
          onDisconnect={connections.google?.token ? onDisconnectGoogle : undefined}
        />
        <Row
          label="Notion"
          detail={
            connections.notion?.token && connections.notion?.databaseId
              ? 'Read-only: page titles, dates and status from one database.'
              : 'Not connected.'
          }
          onDisconnect={connections.notion?.token || connections.notion?.databaseId ? onDisconnectNotion : undefined}
        />
        {ics.map((feed) => (
          <Row
            key={feed.id}
            label={`${feed.source} calendar link`}
            detail={feed.url}
            onDisconnect={() => onDisconnectIcs?.(feed.id)}
            disconnectLabel="Remove"
          />
        ))}
        <Row
          label="Apple CalDAV proxy"
          detail={
            connections.caldav?.proxyUrl && connections.caldav?.calendarUrl
              ? "Reads today's events through your proxy."
              : 'Not connected.'
          }
          onDisconnect={connections.caldav?.proxyUrl || connections.caldav?.calendarUrl ? onDisconnectCaldav : undefined}
        />
        <Row
          label="AI keys"
          detail={`${keyCount} saved in this browser. Never bundled into the app.`}
        />
        <Row
          label="News lens"
          detail={`${prefs.politicalLens ?? 'Neutral / Balanced'} — used only to rank and frame news.`}
        />
      </div>

      {account && (
        <p className="mt-3 text-[0.75rem] text-[var(--faint)]">
          {account.cloud ? 'Preferences sync with your account.' : 'Local-only mode: nothing leaves this device.'}{' '}
          {account.email || 'This device'}
        </p>
      )}

      <p className="mt-3 text-[0.75rem] leading-snug text-[var(--faint)]">
        Calendar titles are never written to a server log. API keys and calendar tokens stay in localStorage.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onClearCache}
          className="inline-flex min-h-12 items-center gap-1.5 rounded-lg border border-[var(--line)] px-2.5 text-[0.8125rem] font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
        >
          <Database size={12} /> Clear cached digest
        </button>
        <button
          type="button"
          onClick={onExportData}
          className="inline-flex min-h-12 items-center gap-1.5 rounded-lg border border-[var(--line)] px-2.5 text-[0.8125rem] font-semibold text-[var(--ink-2)] hover:bg-[var(--paper)]"
        >
          <Download size={12} /> Export my data
        </button>
        <button
          type="button"
          onClick={onDeleteData}
          className="inline-flex min-h-12 items-center gap-1.5 rounded-lg border border-[var(--danger-line)] px-2.5 text-[0.8125rem] font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)]"
        >
          <Trash2 size={12} /> Delete my data
        </button>
        <button
          type="button"
          onClick={onWipeLocalData}
          className="inline-flex min-h-12 items-center gap-1.5 rounded-lg border border-[var(--line)] px-2.5 text-[0.8125rem] font-semibold text-[var(--muted)] hover:bg-[var(--paper)]"
        >
          <Lock size={12} /> Disconnect & wipe local data
        </button>
      </div>
      <p className="metadata mt-3">No secrets in VITE_* variables</p>
    </div>
  )
}
