import { AlertTriangle, CalendarDays, Clock, MapPin, Plus } from 'lucide-react'
import { Badge, Card, CardHeader } from './ui.jsx'

const SOURCE_TONES = {
  Google: 'indigo',
  Notion: 'violet',
  Apple: 'sky',
  Proton: 'amber',
  Preview: 'neutral',
}

const ACCENTS = {
  indigo: 'bg-[#4F46E5]',
  violet: 'bg-[#8B5CF6]',
  emerald: 'bg-[#10B981]',
  sky: 'bg-[#0EA5E9]',
  amber: 'bg-[#F59E0B]',
  neutral: 'bg-[#A1A1AA]',
}

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
  if (differentPlaces && gapMinutes <= 60) return `Leave in about ${gapMinutes} min — different places`
  return ''
}

export default function ScheduleCard({ events = [], loading = false, errors = [], dayNotes = '', onConnect }) {
  return (
    <Card>
      <CardHeader
        icon={CalendarDays}
        eyebrow="What's Ahead Today"
        title="Your day, in order"
        action={
          <div className="flex items-center gap-2">
            <Badge tone="neutral" className="tnum">{events.length} things</Badge>
            <button
              type="button"
              onClick={onConnect}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#E4E4E7] px-2 text-[10px] font-semibold text-[#4F46E5] hover:bg-[#EEF2FF]"
            >
              <Plus size={12} /> Connect
            </button>
          </div>
        }
      />

      <div className="px-5 py-4 sm:px-6">
        {dayNotes && (
          <p className="mb-4 rounded-lg bg-[#EEF2FF]/70 px-2.5 py-2 text-[11px] leading-snug text-[#3730A3]">
            {dayNotes}
          </p>
        )}

        {loading && events.length === 0 && (
          <p className="py-6 text-center text-[11px] text-[#A1A1AA]">Checking your calendars…</p>
        )}

        {!loading && events.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#E4E4E7] px-3 py-6 text-center">
            <p className="text-[12px] font-semibold text-[#3F3F46]">Nothing on the calendar yet.</p>
            <p className="mt-1 text-[11px] leading-snug text-[#A1A1AA]">
              Connect a calendar to see today's events here.
            </p>
            {onConnect && (
              <button
                type="button"
                onClick={onConnect}
                className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#4F46E5] px-3 text-[11px] font-semibold text-white hover:bg-[#4338CA]"
              >
                <Plus size={12} /> Connect a calendar
              </button>
            )}
          </div>
        )}

        {events.map((event, index) => {
          const note = gapNote(event, events[index - 1])
          const active = event.start && event.end && event.start <= new Date() && event.end >= new Date()
          return (
            <div key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
              {index < events.length - 1 && (
                <span className="absolute left-[5px] top-4 bottom-0 w-px bg-[#E4E4E7]" />
              )}
              <span className={`relative z-10 mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-white ${ACCENTS[SOURCE_TONES[event.source]] ?? ACCENTS.indigo}`} />
              <div className={`min-w-0 flex-1 rounded-xl px-2 py-1.5 -mx-2 ${active ? 'bg-[#EEF2FF]/70' : ''}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="tnum text-[11px] font-semibold text-[#4F46E5]">
                    {event.allDay
                      ? 'All day'
                      : event.end
                        ? `${formatTime(event.start)} – ${formatTime(event.end)}`
                        : formatTime(event.start)}
                  </span>
                  <Badge tone={SOURCE_TONES[event.source] ?? 'neutral'}>{event.source}</Badge>
                </div>
                <p className="mt-1 text-[12px] font-semibold leading-snug text-[#09090B]">{event.title}</p>
                {event.location && (
                  <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#A1A1AA]">
                    <MapPin size={10} /> {event.location}
                  </p>
                )}
                {event.status && (
                  <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#A1A1AA]">
                    <Clock size={10} /> {event.status}
                  </p>
                )}
                {note && (
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-[#FFFBEB] px-1.5 py-0.5 text-[10px] font-medium text-[#B45309]">
                    <AlertTriangle size={10} /> {note}
                  </p>
                )}
              </div>
            </div>
          )
        })}

        {errors.length > 0 && (
          <p className="mt-4 border-t border-[#F4F4F5] pt-3 text-[10px] leading-snug text-[#B45309]">
            A few calendars didn't answer: {errors.join(' · ')}
          </p>
        )}
      </div>
    </Card>
  )
}
