import { Card, CardHeader } from './ui.jsx'

function formatTime(date) {
  if (!date) return ''
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function gapNote(event, previous) {
  if (!event?.start || !previous?.end || event.allDay || previous.allDay) return ''
  const gapMinutes = Math.round((event.start.getTime() - previous.end.getTime()) / 60_000)
  const differentPlaces = previous.location && event.location && previous.location !== event.location
  if (gapMinutes < 0) return 'These two overlap'
  if (gapMinutes <= 15) return 'Back-to-back'
  if (differentPlaces && gapMinutes <= 60) return `Leave about ${gapMinutes} min — different places`
  return ''
}

export default function ScheduleCard({ events = [], loading = false, errors = [], dayNotes = '', connected = false, onConnect }) {
  return (
    <Card>
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
        {loading && events.length === 0 && (
          <div aria-hidden="true" className="space-y-3 py-3">
            <div className="h-3 w-1/3 rounded bg-[var(--line-soft)]" />
            <div className="h-4 w-4/5 rounded bg-[var(--line-soft)]" />
            <div className="h-3 w-2/3 rounded bg-[var(--line-soft)]" />
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="py-6">
            <p className="reading-title">{connected ? "Your calendars are clear today." : "Nothing on the calendar yet."}</p>
            <p className="body-copy mt-2">
              {connected ? "Enjoy the open space." : "Connect a calendar to see today's events here."}
            </p>
            {!connected && onConnect && (
              <button type="button" onClick={onConnect} className="primary-button mt-4">Connect a calendar</button>
            )}
          </div>
        )}

        <ol>
          {events.map((event, index) => {
            const note = gapNote(event, events[index - 1])
            const active = event.start && event.end && event.start <= new Date() && event.end >= new Date()
            return (
              <li key={event.id} className="border-b border-[var(--line)] py-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="metadata tnum font-semibold text-[var(--accent)]">
                    {event.allDay
                      ? 'All day'
                      : event.end
                        ? `${formatTime(event.start)} – ${formatTime(event.end)}`
                        : formatTime(event.start)}
                  </span>
                  <span className="metadata">{event.source}</span>
                </div>
                <p className="mt-2 text-[0.9375rem] font-semibold leading-snug text-[var(--ink)]">
                  {event.title}
                  {active && <span className="metadata ml-2 font-normal text-[var(--success)]">Happening now</span>}
                </p>
                {event.location && <p className="metadata mt-1">{event.location}</p>}
                {event.status && <p className="metadata mt-1">{event.status}</p>}
                {note && <p className="mt-2 text-[0.8125rem] font-medium text-[var(--warning)]">{note}</p>}
              </li>
            )
          })}
        </ol>

        {errors.length > 0 && (
          <p aria-live="polite" className="metadata mt-4 text-[var(--warning)]">
            Some calendars didn't answer: {errors.join(' · ')}
          </p>
        )}
      </div>
    </Card>
  )
}
