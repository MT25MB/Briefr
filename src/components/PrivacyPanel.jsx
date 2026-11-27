import { POLITICAL_LENS_LABELS } from '../lib/storage.js'

function Row({ label, detail, onDisconnect, disconnectLabel = 'Disconnect' }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[0.875rem] font-semibold text-[var(--ink)]">{label}</p>
        {detail && <p className="metadata mt-0.5">{detail}</p>}
      </div>
      {onDisconnect && (
        <button
          type="button"
          onClick={onDisconnect}
          className="inline-flex min-h-12 items-center rounded-lg px-2 text-[0.8125rem] font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)]"
        >
          {disconnectLabel}
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
  onOpenAccount,
  onSignOut,
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
  const cloud = Boolean(account?.cloud)

  return (
    <div>
      <h3 className="reading-title">Account, security & privacy</h3>
      <p className="metadata mt-1">
        Keys, calendar tokens, and event details stay on this device. Cloud accounts sync only non-secret preferences and public source identifiers.
      </p>

      <div className="mt-4">
        <Row
          label="Sign-in"
          detail={account ? `${account.email || 'This device'} · ${cloud ? 'cloud account' : 'local guest'}` : 'Not signed in'}
          onDisconnect={onOpenAccount}
          disconnectLabel={account ? 'Manage' : 'Sign in'}
        />
        <Row
          label="Active storage mode"
          detail={cloud ? 'Preferences sync securely with Supabase.' : 'Local only — nothing leaves this device.'}
          onDisconnect={cloud ? onSignOut : undefined}
          disconnectLabel="Sign out"
        />
      </div>

      <div className="mt-5">
        <p className="metadata">Connected sources</p>
        <div className="mt-2">
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
          <Row label="AI keys" detail={`${keyCount} saved in this browser only.`} />
          <Row label="News lens" detail={`${POLITICAL_LENS_LABELS[prefs.politicalLens] ?? 'Neutral / Balanced'} — used only to rank and frame news.`} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={onClearCache} className="quiet-button">Clear today's briefing</button>
        <button type="button" onClick={onWipeLocalData} className="quiet-button">Clear local cache & keys</button>
        <button
          type="button"
          onClick={onExportData}
          disabled={!account}
          title={!account ? 'Choose an account first' : undefined}
          className="quiet-button disabled:opacity-40"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={onDeleteData}
          disabled={!account}
          className="danger-button disabled:opacity-40"
        >
          Delete account & data
        </button>
      </div>
      <p className="metadata mt-3">No secrets in VITE_* variables</p>
    </div>
  )
}
