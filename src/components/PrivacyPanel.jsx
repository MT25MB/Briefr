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
    <div>
      <h3 className="reading-title">Privacy & data</h3>
      <p className="metadata mt-1">
        Keys, calendar tokens, and event details stay on this device. Signing in syncs only preferences.
      </p>

      <div className="mt-4">
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
        <Row label="AI keys" detail={`${keyCount} saved on this device.`} />
        <Row label="News lens" detail={`${prefs.politicalLens ?? 'Neutral / Balanced'} — used only to rank and frame news.`} />
      </div>

      {account && (
        <p className="metadata mt-3">
          {account.cloud ? 'Preferences sync with your account.' : 'Local-only mode.'} {account.email || 'This device'}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onClearCache} className="quiet-button">Clear today's briefing</button>
        <button type="button" onClick={onExportData} className="quiet-button">Download my data</button>
        <button type="button" onClick={onDeleteData} className="danger-button">Delete account & data</button>
        <button type="button" onClick={onWipeLocalData} className="quiet-button">Clear this device</button>
      </div>
    </div>
  )
}
