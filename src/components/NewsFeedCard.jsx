import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Card, CardHeader, Segmented } from './ui.jsx'

const FILTERS = ['All', 'Local', 'Important']
const VIEWS = ['Quick read', 'Every headline']

const LENS_LABELS = {
  'Neutral / Balanced': 'Neutral / Balanced',
  'Conservative / Republican': 'Conservative / Republican',
  'Liberal / Democratic': 'Liberal / Democratic',
  Libertarian: 'Libertarian',
  'Independent / Centrist': 'Independent / Centrist',
  'None / Unfiltered': 'None / Unfiltered',
}

function LoadingLines() {
  return (
    <div aria-hidden="true" className="space-y-3 py-5">
      <div className="h-3 w-2/5 rounded bg-[var(--line-soft)]" />
      <div className="h-4 w-11/12 rounded bg-[var(--line-soft)]" />
      <div className="h-3 w-full rounded bg-[var(--line-soft)]" />
      <div className="h-3 w-3/4 rounded bg-[var(--line-soft)]" />
    </div>
  )
}

function EmptyState({ onOpenSettings, onShowAll }) {
  return (
    <div className="py-8">
      <p className="reading-title">No headlines to show.</p>
      <p className="body-copy mt-2">Add a news feed in settings, or show every headline.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={onOpenSettings} className="primary-button">Add a feed</button>
        {onShowAll && <button type="button" onClick={onShowAll} className="quiet-button">Show all</button>}
      </div>
    </div>
  )
}

function Story({ story }) {
  return (
    <article className="py-5">
      <p className="metadata">
        {story.source || 'Feed'}
        {story.category ? ` · ${story.category}` : ''}
        {story.time ? ` · ${story.time}` : ''}
      </p>
      <h3 className="reading-title mt-2 line-clamp-3" title={story.title}>{story.title}</h3>
      <p className="body-copy mt-2 line-clamp-3" title={story.summary}>{story.summary}</p>
      {story.whyItMatters && (
        <p className="mt-3 line-clamp-3 text-[0.875rem] leading-relaxed text-[var(--muted)]" title={story.whyItMatters}>
          <span className="font-semibold text-[var(--ink)]">Why it matters: </span>
          {story.whyItMatters}
        </p>
      )}
      {story.url && (
        <a
          href={story.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex min-h-12 items-center gap-1 text-[0.875rem] font-semibold text-[var(--accent)] hover:underline"
        >
          Read the source <ArrowUpRight size={13} aria-hidden="true" />
        </a>
      )}
    </article>
  )
}

function RawList({ items }) {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={`${item.link}-${index}`}>
          <a href={item.link} target="_blank" rel="noreferrer" className="group block min-h-16 py-4">
            <span className="block text-[0.9375rem] font-medium leading-snug text-[var(--ink)] group-hover:text-[var(--accent)]">
              {item.title}
            </span>
            <span className="metadata mt-1 block truncate">
              {item.source} · {item.time || 'recent'} · {item.category}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}

export default function NewsFeedCard({
  digest,
  items = [],
  source = 'raw',
  loading = false,
  error = null,
  politicalLens = 'Neutral / Balanced',
  coverageMode = 'Balanced / Both Sides',
  onResetLens,
  onOpenSettings,
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
        title="The news"
        action={<Segmented options={VIEWS} value={view} onChange={setView} size="sm" className="shrink-0" />}
      />

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-6 pt-4">
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex min-h-12 items-center text-[0.875rem] font-semibold text-[var(--accent)] hover:underline"
        >
          Lens: {LENS_LABELS[politicalLens] ?? politicalLens}
        </button>
        <span className="metadata">
          {coverageMode === 'Aligned Lens' ? 'Aligned lens' : 'Both sides when available'}
        </span>
        {politicalLens !== 'Neutral / Balanced' && onResetLens && (
          <button
            type="button"
            onClick={onResetLens}
            className="metadata ml-auto inline-flex min-h-12 items-center underline hover:text-[var(--ink)]"
          >
            Reset to neutral
          </button>
        )}
      </div>

      <div className="flex gap-6 px-6">
        {FILTERS.map((item) => {
          const active = filter === item
          const count =
            item === 'All'
              ? hasAi ? local.length + important.length : items.length
              : hasAi
                ? (item === 'Local' ? local.length : important.length)
                : rawForFilter.length
          return (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              aria-pressed={active}
              className={`inline-flex min-h-12 items-center gap-2 border-b-2 text-[0.875rem] font-semibold ${
                active ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--faint)] hover:text-[var(--ink)]'
              }`}
            >
              {item}
              <span className="metadata tnum">{count}</span>
            </button>
          )
        })}
      </div>

      {!hasAi && view === 'Quick read' && items.length > 0 && (
        <p className="metadata mx-6 mt-4">
          Plain headlines for now. A key in settings turns them into a short read.
        </p>
      )}

      {loading && <LoadingLines />}
      <p aria-live="polite" className="sr-only">{loading ? 'Fetching and ranking feeds' : ''}</p>

      {!loading && (showDigest ? (
        <div className="px-6">
          {stories.length ? (
            stories.map((story, index) => <Story key={`${story.url}-${index}`} story={story} />)
          ) : (
            <EmptyState onOpenSettings={onOpenSettings} onShowAll={() => setFilter('All')} />
          )}
        </div>
      ) : (
        <div className="px-6">
          {rawForFilter.length ? <RawList items={rawForFilter} /> : <EmptyState onOpenSettings={onOpenSettings} />}
        </div>
      ))}

      {error && <p className="metadata px-6 pb-4 text-[var(--warning)]">{error}</p>}
    </Card>
  )
}
