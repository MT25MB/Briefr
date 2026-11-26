import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card, CardHeader } from './ui.jsx'

const GROUP_LABELS = {
  'Needs Action': 'Needs a reply',
  FYI: 'Just so you know',
  'Newsletters & Promos': 'Newsletters & promos',
}

function Message({ message }) {
  return (
    <div className="py-4 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-[0.9375rem] font-semibold text-[var(--ink)]">{message.sender}</span>
        <span className="metadata tnum">{message.time}</span>
      </div>
      <p className="mt-1 text-[0.875rem] text-[var(--muted)]">{message.subject}</p>
      <p className="metadata mt-1 line-clamp-2">{message.snippet}</p>
    </div>
  )
}

export default function TriageCard({ inbox, result, loading = false, onTriage }) {
  const [group, setGroup] = useState('Needs Action')
  const [showPromos, setShowPromos] = useState(false)
  const [input, setInput] = useState('')

  const submit = () => {
    if (!input.trim() || loading) return
    onTriage(input.trim())
  }

  return (
    <Card>
      <CardHeader
        title="Your inbox"
        action={
          <span className="metadata tnum">
            {inbox.needsAction.length} need a reply
          </span>
        }
      />

      <div className="px-6 pt-4">
        <div className="flex gap-6">
          {['Needs Action', 'FYI'].map((item) => {
            const active = group === item
            const count = item === 'Needs Action' ? inbox.needsAction.length : inbox.fyi.length
            return (
              <button
                key={item}
                type="button"
                onClick={() => setGroup(item)}
                aria-pressed={active}
                className={`-mb-px inline-flex min-h-12 items-center gap-2 border-b-2 text-[0.875rem] font-semibold ${
                  active ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--faint)] hover:text-[var(--ink)]'
                }`}
              >
                {GROUP_LABELS[item]}
                <span className="metadata tnum">{count}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-2">
          {(group === 'Needs Action' ? inbox.needsAction : inbox.fyi).length ? (
            (group === 'Needs Action' ? inbox.needsAction : inbox.fyi).map((message) => (
              <Message key={message.id} message={message} />
            ))
          ) : (
            <p className="metadata py-4">Nothing in this group.</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowPromos((value) => !value)}
          aria-expanded={showPromos}
          className="flex min-h-12 w-full items-center gap-2 text-left text-[0.875rem] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
        >
          <ChevronDown size={14} className={`shrink-0 transition-transform ${showPromos ? 'rotate-180' : ''}`} aria-hidden="true" />
          {GROUP_LABELS['Newsletters & Promos']}
          <span className="metadata tnum ml-auto">{inbox.newsletters.length}</span>
        </button>
        {showPromos && (
          <div className="mt-2 space-y-2 pb-2">
            {inbox.newsletters.length ? (
              inbox.newsletters.map((item) => (
                <p key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-4 text-[0.875rem]">
                  <span className="truncate text-[var(--muted)]">
                    <span className="font-semibold text-[var(--ink)]">{item.sender}</span> — {item.subject}
                  </span>
                  <span className="metadata tnum">{item.time}</span>
                </p>
              ))
            ) : (
              <p className="metadata py-2">No promos in this preview.</p>
            )}
          </div>
        )}
      </div>

      <section className="mt-4 px-6 py-5" aria-label="Sort a message">
        <h3 className="reading-title">Sort a message</h3>
        <p className="metadata mt-2">Paste an email or chat message. It's sorted in your browser — nothing is saved on a server.</p>
        <label htmlFor="triage-input" className="sr-only">Message to sort</label>
        <textarea
          id="triage-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={3}
          placeholder="Can you approve invoice #2048 by noon?"
          className="field mt-3 resize-y leading-relaxed"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!input.trim() || loading}
          className="primary-button mt-3"
        >
          {loading ? 'Sorting…' : 'Sort this message'}
        </button>

        <div aria-live="polite">
          {result ? (
            <div className="mt-5">
              <p className="text-[0.875rem] font-semibold text-[var(--accent)]">
                {GROUP_LABELS[result.category] ?? result.category}
              </p>
              {result.summary && <p className="mt-2 text-[0.9375rem] leading-relaxed text-[var(--ink)]">{result.summary}</p>}
              {result.reason && <p className="metadata mt-2">{result.reason}</p>}
              {result.nextStep && (
                <p className="mt-3 text-[0.875rem] font-semibold text-[var(--ink)]">
                  Next step: {result.nextStep}
                </p>
              )}
            </div>
          ) : (
            <p className="metadata mt-5">Paste a message to see where it belongs and what to do next.</p>
          )}
        </div>
      </section>
    </Card>
  )
}
