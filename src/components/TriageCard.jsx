import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card, CardHeader } from './ui.jsx'

const TABS = [
  { key: 'needsAction', label: 'Needs action' },
  { key: 'fyi', label: 'FYI' },
  { key: 'noiseItems', label: 'Newsletters & promos' },
]

function ActionItem({ item, copied, onComplete, onCopy }) {
  return (
    <li className={`border-b border-[var(--line)] py-4 last:border-0 ${item.done ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className={`text-[0.9375rem] font-semibold text-[var(--ink)] ${item.done ? 'line-through' : ''}`}>
          {item.sender}
        </span>
        {item.urgency && <span className="metadata text-[var(--warning)]">{item.urgency}</span>}
      </div>
      <p className="mt-1 text-[0.875rem] leading-relaxed text-[var(--muted)]">{item.summary}</p>
      {item.suggestedAction && (
        <p className="mt-2 text-[0.875rem] font-semibold text-[var(--ink)]">{item.suggestedAction}</p>
      )}
      {item.scheduleNote && (
        <p className="metadata mt-2 text-[var(--warning)]">{item.scheduleNote}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        {!item.done && (
          <button
            type="button"
            onClick={() => onComplete(item.id)}
            aria-pressed={false}
            className="quiet-button"
          >
            Mark done
          </button>
        )}
        {item.suggestedAction && (
          <button type="button" onClick={() => onCopy(item)} className="quiet-button">
            {copied ? 'Copied' : 'Copy draft reply'}
          </button>
        )}
      </div>
    </li>
  )
}

function SimpleItem({ item }) {
  return (
    <li className="border-b border-[var(--line)] py-3 last:border-0">
      <span className="text-[0.875rem] font-semibold text-[var(--ink)]">{item.sender}</span>
      <p className="metadata mt-0.5">{item.summary}</p>
    </li>
  )
}

export default function TriageCard({ id, triage, loading = false, onTriage, onComplete, onClear }) {
  const [input, setInput] = useState('')
  const [tab, setTab] = useState('needsAction')
  const [showNoise, setShowNoise] = useState(false)
  const [copied, setCopied] = useState('')

  const groups = triage?.needsAction ?? []
  const noiseItems = triage?.noiseItems ?? []
  const hasResult =
    groups.length + (triage?.fyi?.length ?? 0) + noiseItems.length > 0
  const openCount = groups.filter((item) => !item.done).length

  const submit = () => {
    if (!input.trim() || loading) return
    onTriage(input.trim())
  }

  const reset = () => {
    onClear?.()
    setInput('')
    setTab('needsAction')
    setShowNoise(false)
    setCopied('')
  }

  const copyStep = async (item) => {
    try {
      await navigator.clipboard.writeText(item.suggestedAction)
      setCopied(item.id)
      window.setTimeout(() => setCopied(''), 1800)
    } catch {
      setCopied('')
    }
  }

  const visible = tab === 'noiseItems' ? noiseItems : triage?.[tab] ?? []

  return (
    <Card id={id}>
      <CardHeader
        title="Your inbox"
        action={<span className="metadata tnum">{openCount} need a reply</span>}
      />

      <div className="px-6 py-5">
        <section aria-label="Quick paste">
          <h3 className="reading-title">Quick paste</h3>
          <p className="metadata mt-1">
            Paste an email, chat message, or forwarded note. It's used for this briefing only and isn't saved to a server.
          </p>
          <label htmlFor="triage-input" className="sr-only">Message to sort</label>
          <textarea
            id="triage-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') submit()
            }}
            rows={3}
            placeholder="Can you approve invoice #2048 by noon?"
            className="field mt-3 resize-y leading-relaxed"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={submit} disabled={!input.trim() || loading} className="primary-button disabled:opacity-40">
              {loading ? 'Sorting…' : 'Sort this message'}
            </button>
            {hasResult && (
              <button type="button" onClick={submit} disabled={!input.trim() || loading} className="quiet-button">
                Re-run
              </button>
            )}
            {hasResult && (
              <button type="button" onClick={reset} className="quiet-button">Clear / new paste</button>
            )}
          </div>
          {hasResult && (
            <p className="metadata mt-2">
              Sorted {triage.source === 'ai' ? 'with AI' : 'on your device'} · today only
            </p>
          )}
        </section>

        <div className="mt-6 flex flex-wrap gap-6" role="tablist" aria-label="Inbox groups">
          {TABS.map(({ key, label }) => {
            const active = tab === key
            const count = key === 'noiseItems' ? (triage?.noiseCount ?? noiseItems.length) : (triage?.[key] ?? []).length
            return (
              <button
                key={key}
                type="button"
                role="tab"
                id={`triage-tab-${key}`}
                aria-controls="triage-panel"
                onClick={() => setTab(key)}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                  const index = TABS.findIndex((entry) => entry.key === tab)
                  const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
                  setTab(TABS[next].key)
                  event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')?.[next]?.focus()
                }}
                aria-selected={active}
                className={`-mb-px inline-flex min-h-12 items-center gap-2 border-b-2 text-[0.875rem] font-semibold ${
                  active ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--faint)] hover:text-[var(--ink)]'
                }`}
              >
                {label}
                <span className="metadata tnum">{count}</span>
              </button>
            )
          })}
        </div>

        <p aria-live="polite" className="sr-only">
          {loading ? 'Sorting your message' : `${visible.length} items in this group`}
        </p>

        <div id="triage-panel" role="tabpanel" aria-labelledby={`triage-tab-${tab}`} tabIndex={0}>
        {tab === 'noiseItems' ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowNoise((value) => !value)}
              aria-expanded={showNoise}
              className="flex min-h-12 w-full items-center gap-2 text-left text-[0.875rem] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <ChevronDown size={14} className={`shrink-0 transition-transform ${showNoise ? 'rotate-180' : ''}`} aria-hidden="true" />
              {showNoise ? 'Hide low-value threads' : `Show ${visible.length} low-value threads`}
            </button>
            {showNoise && (
              <ul className="mt-2">
                {visible.length ? (
                  visible.map((item) => <SimpleItem key={item.id} item={item} />)
                ) : (
                  <li className="metadata py-4">Nothing here.</li>
                )}
              </ul>
            )}
          </div>
        ) : visible.length ? (
          <ul className="mt-2">
            {tab === 'needsAction'
              ? visible.map((item) => (
                  <ActionItem
                    key={item.id}
                    item={item}
                    copied={copied === item.id}
                    onComplete={onComplete}
                    onCopy={copyStep}
                  />
                ))
              : visible.map((item) => <SimpleItem key={item.id} item={item} />)}
          </ul>
        ) : (
          <p className="metadata py-5">
            {hasResult ? 'Nothing in this group.' : 'Paste a message above to sort your inbox.'}
          </p>
        )}
        </div>
      </div>
    </Card>
  )
}
