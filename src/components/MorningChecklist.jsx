import { eventStart, formatTime } from '../lib/schedule.js'

export default function MorningChecklist({ eventCount, openActions, upNext, timingFlags, onOpenDay, onOpenInbox }) {
  const nextTime = upNext ? formatTime(eventStart(upNext)) : ''
  const flagLabel = timingFlags === 1 ? '1 timing flag' : `${timingFlags} timing flags`

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-[var(--line)] py-2">
      <span className="metadata">Morning checklist</span>
      <button
        type="button"
        onClick={onOpenDay}
        className="metadata tnum inline-flex min-h-12 items-center font-semibold text-[var(--ink)] hover:text-[var(--accent)]"
      >
        {eventCount} {eventCount === 1 ? 'event' : 'events'} today
      </button>
      <button
        type="button"
        onClick={onOpenInbox}
        className="metadata tnum inline-flex min-h-12 items-center font-semibold text-[var(--ink)] hover:text-[var(--accent)]"
      >
        {openActions} need {openActions === 1 ? 'a reply' : 'replies'}
      </button>
      {upNext && (
        <span className="metadata tnum">
          Next · {nextTime} {upNext.title}
        </span>
      )}
      {timingFlags > 0 && <span className="metadata text-[var(--warning)]">{flagLabel}</span>}
    </div>
  )
}
