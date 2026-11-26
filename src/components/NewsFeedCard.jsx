import { useState } from 'react'
import { ArrowUpRight, Lightbulb, List, Newspaper, Sparkles } from 'lucide-react'
import { Badge, Card, CardHeader, Segmented } from './ui.jsx'

const FILTERS = ['All', 'Local', 'Important']
const VIEWS = ['Quick read', 'Every headline']

const LENS_LABELS = {
  'Balanced / Neutral': 'Balanced',
  'Conservative / Republican': 'Conservative',
  'Liberal / Democratic': 'Liberal',
  Libertarian: 'Libertarian',
  'Independent / Centrist': 'Centrist',
  'Custom / No Political Filtering': 'No filtering',
}

function Story({ story }) {
  return (
    <article className="rounded-xl border border-[#F4F4F5] p-4 transition-colors hover:border-[#E4E4E7] hover:bg-[#FCFCFD]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-[#EEF2FF] px-1.5 py-0.5 text-[10px] font-semibold text-[#4F46E5]">
          {story.source || 'Feed'}
        </span>
        <Badge tone={story.category === 'Local News' ? 'indigo' : 'amber'}>{story.category || 'Story'}</Badge>
      </div>
      <h3 className="mt-2.5 text-[14px] font-semibold leading-snug tracking-[-0.01em] text-[#09090B]">
        {story.title}
      </h3>
      <p className="mt-1.5 text-[12px] leading-[1.6] text-[#52525B]">{story.summary}</p>
      {story.whyItMatters && (
        <div className="mt-3 flex gap-2 rounded-lg bg-[#EEF2FF]/60 px-2.5 py-2 text-[#3730A3]">
          <Lightbulb size={13} className="mt-0.5 shrink-0 text-[#4F46E5]" />
          <p className="text-[11px] leading-[1.5]">
            <span className="font-semibold">Why it matters: </span>
            {story.whyItMatters}
          </p>
        </div>
      )}
      {story.url && (
        <a
          href={story.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#4F46E5] hover:underline"
        >
          Read source <ArrowUpRight size={12} />
        </a>
      )}
    </article>
  )
}

function RawList({ items }) {
  if (!items.length) {
    return <p className="px-1 py-6 text-center text-[11px] text-[#A1A1AA]">Nothing here right now.</p>
  }
  return (
    <div>
      {items.map((item, index) => (
        <a
          key={`${item.link}-${index}`}
          href={item.link}
          target="_blank"
          rel="noreferrer"
          className="group flex items-start gap-3 border-b border-[#F4F4F5] py-3 last:border-0 hover:bg-[#FCFCFD]"
        >
          <span className="tnum mt-0.5 w-4 shrink-0 text-[11px] font-semibold text-[#D4D4D8]">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium leading-snug text-[#3F3F46] group-hover:text-[#09090B]">
              {item.title}
            </p>
            <p className="mt-1 truncate text-[10px] text-[#A1A1AA]">
              {item.source} · {item.time || 'recent'} · {item.category}
            </p>
          </div>
          <ArrowUpRight size={13} className="mt-0.5 shrink-0 text-[#D4D4D8] group-hover:text-[#4F46E5]" />
        </a>
      ))}
    </div>
  )
}

export default function NewsFeedCard({
  digest,
  items = [],
  source = 'raw',
  loading = false,
  meta = null,
  error = null,
  sourceCount = 0,
  politicalLens = 'Balanced / Neutral',
  perspectiveMode = 'Cross-perspective',
  onResetLens,
}) {
  const [view, setView] = useState('Quick read')
  const [filter, setFilter] = useState('All')

  const hasAi = source === 'ai' && Boolean(digest)
  const local = hasAi ? digest.local ?? [] : []
  const important = hasAi ? digest.important ?? [] : []
  const rawForFilter =
    filter === 'Local'
      ? items.filter((item) => item.category === 'Local News')
      : filter === 'Important'
        ? items.filter((item) => item.category !== 'Local News')
        : items
  const stories = filter === 'Local' ? local : filter === 'Important' ? important : [...local, ...important]
  const showDigest = view === 'Quick read' && hasAi

  return (
    <Card>
      <CardHeader
        icon={Newspaper}
        eyebrow="Curated news"
        title="Your briefing"
        action={
          <Segmented options={VIEWS} value={view} onChange={setView} size="sm" className="shrink-0" />
        }
      />

      {politicalLens !== 'Balanced / Neutral' && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#F4F4F5] bg-[#FAFAFA] px-5 py-2 sm:px-6">
          <Badge tone="indigo">Lens: {LENS_LABELS[politicalLens] ?? politicalLens}</Badge>
          <span className="text-[10px] text-[#A1A1AA]">
            {perspectiveMode === 'Mostly aligned' ? 'Mostly your view' : 'Both sides when available'}
          </span>
          {onResetLens && (
            <button
              type="button"
              onClick={onResetLens}
              className="ml-auto text-[10px] font-semibold text-[#4F46E5] hover:underline"
            >
              Back to balanced
            </button>
          )}
        </div>
      )}

      <div className="flex gap-5 border-b border-[#F4F4F5] px-5 sm:px-6">
        {FILTERS.map((item) => {
          const active = filter === item
          const count =
            item === 'All'
              ? hasAi
                ? local.length + important.length
                : items.length
              : item === 'Local'
                ? hasAi
                  ? local.length
                  : rawForFilter.length
                : hasAi
                  ? important.length
                  : rawForFilter.length
          return (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`-mb-px flex items-center gap-2 border-b-2 py-3 text-[12px] font-semibold transition-colors ${
                active ? 'border-[#4F46E5] text-[#4F46E5]' : 'border-transparent text-[#A1A1AA] hover:text-[#52525B]'
              }`}
            >
              {item}
              <span className={`tnum rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-[#EEF2FF]' : 'bg-[#F4F4F5]'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {!hasAi && view === 'Quick read' && (
        <div className="mx-5 mt-4 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[11px] leading-snug text-[#B45309] sm:mx-6">
          We're showing the plain headlines for now. Add an AI key in settings if you'd like these sorted into a short read.
        </div>
      )}

      {loading && (
        <p className="flex items-center gap-1.5 px-5 pt-4 text-[11px] text-[#A1A1AA] sm:px-6">
          <Sparkles size={11} className="animate-pulse text-[#4F46E5]" /> Fetching and ranking feeds…
        </p>
      )}

      {showDigest ? (
        <div className="space-y-3 px-5 py-5 sm:px-6">
          <p className="flex items-center gap-1.5 text-[11px] text-[#A1A1AA]">
            <Sparkles size={11} className="text-[#4F46E5]" />
            Put together from {sourceCount || items.length} places
            {meta ? ` with ${meta.provider}` : ''}
          </p>
          {stories.length ? (
            stories.map((story, index) => <Story key={`${story.url}-${index}`} story={story} />)
          ) : (
            <p className="py-4 text-center text-[11px] text-[#A1A1AA]">Nothing here right now.</p>
          )}
        </div>
      ) : (
        <div className="px-5 py-3 sm:px-6">
          <RawList items={rawForFilter} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F4F4F5] px-5 py-3 text-[10px] text-[#A1A1AA] sm:px-6">
        <span className="inline-flex items-center gap-1.5">
          <List size={11} /> {sourceCount || items.length} places checked · {items.length} headlines
        </span>
        <span>
          {hasAi ? (meta?.cached ? 'Saved earlier today' : 'Just put together') : 'Plain headlines'}
          {error ? ` · ${error}` : ''}
        </span>
      </div>
    </Card>
  )
}
