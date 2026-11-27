import { useMemo, useState } from 'react'
import { Card, CardHeader } from './ui.jsx'
import { formatCountdown, prepareSchedule, timeRange } from '../lib/schedule.js'

function UpNext({ event, isCurrent }) {
  if (!event) return null
  const details = [event.location, event.notes].filter(Boolean).join(' · ')
  return (
    <div className="mb-5 border-l-2 border-[var(--accent)] pl-4">
      <p className="metadata">Up next</p>
      <p className="reading-title mt-1">{event.title}</p>
      <p className="metadata tnum mt-1">
        {timeRange(event)} · {isCurrent ? 'Happening now' : formatCountdown(event)}
      </p>
      {details && <p className="metadata mt-1">{details}</p>}
    </div>
  )
}

function QuickAdd({ onAdd }) {
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')

  const submit = (event) => {
    event.preventDefault()
    if (!title.trim()) return
    onAdd({ title: title.trim(), time, location: location.trim() })
    setTitle('')
    setTime('')
    setLocation('')
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-2">
      <label htmlFor="quick-title" className="sr-only">Event title</label>
      <input
        id="quick-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="What's happening?"
        className="field min-h-12"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <label htmlFor="quick-time" className="sr-only">Start time</label>
        <input
          id="quick-time"
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          className="field min-h-12"
        />
        <label htmlFor="quick-location" className="sr-only">Location</label>
        <input
          id="quick-location"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Where? (optional)"
          className="field min-h-12"
        />
      </div>
      <button type="submit" disabled={!title.trim()} className="primary-button disabled:opacity-40">
        Add to today
      </button>
    </form>
  )
}

export default function ScheduleCard({
  id,
  events = [],
  loading = false,
  errors = [],
  dayNotes = '',
  connected = false,
  onConnect,
  onAddQuickEvent,
  onRetry,
}) {
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const schedule = useMemo(() => prepareSchedule(events), [events])
  const hasEvents = events.length > 0

  return (
    <Card id={id}>
      <CardHeader
        title="Your day"
        action={
          <div className="flex items-baseline gap-4">
            <span className="metadata tnum">{events.length} {events.length === 1 ? 'event' : 'events'}</span>
            <button type="button" onClick={onConnect} className="inline-flex min-h-12 text-[0.875rem] font-semibold text-[var(--accent)] hover:underline">
              Add calendar
            </button>
          </div>
        }
      />

      <div className="px-6 py-5">
        {dayNotes && <p className="mb-5 text-[0.875rem] leading-relaxed text-[var(--muted)]">{dayNotes}</p>}

        <p aria-live="polite" className="sr-only">
          {loading ? 'Checking your calendars' : `${events.length} events today`}
        </p>

        {loading && !hasEvents && (
          <div aria-hidden="true" className="space-y-3 py-3">
            <div className="h-3 w-1/3 rounded bg-[var(--line-soft)]" />
            <div className="h-4 w-4/5 rounded bg-[var(--line-soft)]" />
            <div className="h-3 w-2/3 rounded bg-[var(--line-soft)]" />
          </div>
        )}

        {!loading && !hasEvents && (
          <div className="py-2">
            <p className="reading-title">{connected ? 'Your calendars are clear today.' : 'Nothing on the calendar yet.'}</p>
            <p className="body-copy mt-2">
              {connected
                ? 'Add a one-off event if something comes up.'
                : 'Connect a calendar, or add one thing you need to remember today.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {!connected && onConnect && (
                <button type="button" onClick={onConnect} className="primary-button">Connect a calendar</button>
              )}
              <button
                type="button"
                onClick={() => setShowQuickAdd((value) => !value)}
                aria-expanded={showQuickAdd}
                className="quiet-button"
              >
                {showQuickAdd ? 'Cancel' : 'Add a quick event'}
              </button>
            </div>
            {showQuickAdd && onAddQuickEvent && <QuickAdd onAdd={onAddQuickEvent} />}
          </div>
        )}

        {hasEvents && (
          <>
            <UpNext event={schedule.upNext} isCurrent={schedule.isUpNextCurrent} />

            {schedule.allDay.length > 0 && (
              <div className="mb-5">
                <p className="metadata">All day</p>
                <ul className="mt-2 space-y-1">
                  {schedule.allDay.map((event) => (
                    <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 text-[0.875rem]">
                      <span className="font-semibold text-[var(--ink)]">{event.title}</span>
                      <span className="metadata">{event.source}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ol>
              {schedule.timed.map((event) => {
                const note = schedule.friction[event.id]
                const active = schedule.current?.id === event.id
                return (
                  <li key={event.id} className="border-b border-[var(--line)] py-4 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="metadata tnum font-semibold text-[var(--accent)]">{timeRange(event)}</span>
                      <span className="metadata">{event.source}</span>
                    </div>
                    <p className="mt-2 text-[0.9375rem] font-semibold leading-snug text-[var(--ink)]">
                      {event.title}
                      {active && <span className="metadata ml-2 font-normal text-[var(--success)]">Happening now</span>}
                    </p>
                    {event.location && <p className="metadata mt-1">{event.location}</p>}
                    {event.notes && <p className="metadata mt-1">{event.notes}</p>}
                    {note && <p className="mt-2 text-[0.8125rem] font-medium text-[var(--warning)]">{note}</p>}
                  </li>
                )
              })}
            </ol>

            {onAddQuickEvent && (
              <button
                type="button"
                onClick={() => setShowQuickAdd((value) => !value)}
                aria-expanded={showQuickAdd}
                className="quiet-button mt-4"
              >
                {showQuickAdd ? 'Cancel' : 'Add a quick event'}
              </button>
            )}
            {showQuickAdd && onAddQuickEvent && <QuickAdd onAdd={onAddQuickEvent} />}
          </>
        )}

        {errors.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3" aria-live="polite">
            <p className="metadata text-[var(--warning)]">Some calendars didn't answer: {errors.join(' · ')}</p>
            {onRetry && <button type="button" onClick={onRetry} className="quiet-button">Retry calendars</button>}
          </div>
        )}
      </div>
    </Card>
  )
}
