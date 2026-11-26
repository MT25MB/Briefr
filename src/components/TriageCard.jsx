import { useState } from 'react'
import { ChevronDown, Inbox, Loader2, Lock, Send, Sparkles } from 'lucide-react'
import { Badge, Card, CardHeader } from './ui.jsx'

const AVATAR_TONES = [
  'bg-[#EEF2FF] text-[#4F46E5]',
  'bg-[#FFF1F2] text-[#BE123C]',
  'bg-[#ECFDF5] text-[#047857]',
]

const CATEGORY_TONES = {
  'Needs Action': 'rose',
  FYI: 'indigo',
  'Newsletters & Promos': 'amber',
}

const GROUP_LABELS = {
  'Needs Action': 'Needs a reply',
  FYI: 'Just so you know',
  'Newsletters & Promos': 'Newsletters & promos',
}

function Message({ message, index, actionable }) {
  return (
    <div className="flex gap-2.5 border-b border-[#F4F4F5] py-3 last:border-0">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${AVATAR_TONES[index % AVATAR_TONES.length]}`}>
        {message.initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[11px] font-semibold text-[#3F3F46]">{message.sender}</span>
          <span className="tnum shrink-0 text-[10px] text-[#A1A1AA]">{message.time}</span>
        </div>
        <p className="mt-0.5 truncate text-[12px] font-medium text-[#09090B]">{message.subject}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#A1A1AA]">{message.snippet}</p>
      </div>
      {actionable && (
        <button
          type="button"
          className="mt-5 h-fit shrink-0 rounded-lg border border-[#E4E4E7] px-2 py-2 text-[10px] font-semibold text-[#4F46E5] hover:bg-[#EEF2FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40"
        >
          {message.action}
        </button>
      )}
    </div>
  )
}

export default function TriageCard({ inbox, result, loading = false, source = 'rules', onTriage }) {
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
        icon={Inbox}
        eyebrow="Inbox & messages"
        title="Your inbox"
        action={<Badge tone="rose" className="tnum">{inbox.needsAction.length} need a reply</Badge>}
      />

      <div className="px-5 pt-3 sm:px-6">
        <div className="flex gap-4 border-b border-[#F4F4F5]">
          {['Needs Action', 'FYI'].map((item) => {
            const active = group === item
            const count = item === 'Needs Action' ? inbox.needsAction.length : inbox.fyi.length
            return (
              <button
                key={item}
                type="button"
                onClick={() => setGroup(item)}
                className={`-mb-px flex items-center gap-1.5 border-b-2 py-2.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40 ${
                  active ? 'border-[#4F46E5] text-[#4F46E5]' : 'border-transparent text-[#A1A1AA] hover:text-[#52525B]'
                }`}
              >
                {GROUP_LABELS[item] ?? item}
                <span className={`tnum rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-[#EEF2FF]' : 'bg-[#F4F4F5]'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="py-1">
          {(group === 'Needs Action' ? inbox.needsAction : inbox.fyi).map((message, index) => (
            <Message key={message.id} message={message} index={index} actionable={group === 'Needs Action'} />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowPromos((value) => !value)}
          className="my-2 flex min-h-11 w-full items-center gap-2 rounded-lg bg-[#FAFAFA] px-2.5 py-2 text-left text-[11px] font-medium text-[#71717A] hover:bg-[#F4F4F5]"
        >
          <ChevronDown size={13} className={`shrink-0 transition-transform ${showPromos ? 'rotate-180' : ''}`} />
          {GROUP_LABELS['Newsletters & Promos']}
          <span className="tnum ml-auto rounded-full bg-[#E4E4E7] px-1.5 py-0.5 text-[10px] text-[#52525B]">
            {inbox.newsletters.length}
          </span>
        </button>
        {showPromos && (
          <div className="-mt-1 mb-2 space-y-1.5 rounded-lg border border-[#F4F4F5] p-2.5">
            {inbox.newsletters.length ? (
              inbox.newsletters.map((item) => (
                <div key={item.id} className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="truncate text-[#52525B]">
                    <span className="font-semibold text-[#3F3F46]">{item.sender}</span> — {item.subject}
                  </span>
                  <span className="tnum shrink-0 text-[10px] text-[#A1A1AA]">{item.time}</span>
                </div>
              ))
            ) : (
              <p className="py-2 text-center text-[11px] text-[#A1A1AA]">No promos in this preview.</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 border-t border-[#F4F4F5] bg-[#FCFCFD] px-5 py-4 sm:px-6">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#3F3F46]">
          <Sparkles size={13} className="text-[#4F46E5]" /> Paste a message
        </p>
        <p className="mt-1 flex items-start gap-1.5 text-[10px] leading-snug text-[#A1A1AA]">
          <Lock size={11} className="mt-0.5 shrink-0" />
          Paste an email, a chat message, or a text. We sort it right here in your browser — nothing
          is saved on a server.
        </p>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={3}
          placeholder="e.g. Can you approve invoice #2048 by noon?"
          className="mt-2.5 w-full resize-none rounded-xl border border-[#E4E4E7] bg-white px-3 py-2 text-[12px] leading-relaxed text-[#09090B] placeholder:text-[#A1A1AA] focus:border-[#A5B4FC] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/10"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!input.trim() || loading}
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[#4F46E5] px-3 py-2 text-[11px] font-semibold text-white hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          {loading ? 'Checking…' : 'Check this message'}
        </button>

        {result ? (
          <div className="mt-3 rounded-xl border border-[#E4E4E7] bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone={CATEGORY_TONES[result.category] ?? 'neutral'}>
                {GROUP_LABELS[result.category] ?? result.category}
              </Badge>
              <span className="text-[10px] text-[#A1A1AA]">
                {source === 'ai' ? 'Sorted with AI' : 'Sorted on your device'}
              </span>
            </div>
            {result.summary && <p className="mt-2 text-[11px] leading-snug text-[#3F3F46]">{result.summary}</p>}
            {result.reason && <p className="mt-1 text-[10px] leading-snug text-[#A1A1AA]">{result.reason}</p>}
            {result.nextStep && (
              <p className="mt-2 rounded-lg bg-[#EEF2FF]/70 px-2 py-1.5 text-[11px] font-medium text-[#4F46E5]">
                Try this: {result.nextStep}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-[#E4E4E7] px-3 py-4 text-center text-[11px] text-[#A1A1AA]">
            Paste a message above to see where it belongs and what to do next.
          </div>
        )}
      </div>
    </Card>
  )
}
