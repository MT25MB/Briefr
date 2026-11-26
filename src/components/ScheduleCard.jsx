import { CalendarDays, Clock, MapPin } from 'lucide-react'
import { Badge, Card, CardHeader } from './ui.jsx'

const ACCENTS = {
  indigo: 'bg-[#4F46E5]',
  violet: 'bg-[#8B5CF6]',
  emerald: 'bg-[#10B981]',
  sky: 'bg-[#0EA5E9]',
  amber: 'bg-[#F59E0B]',
}

export default function ScheduleCard({ items }) {
  return (
    <Card>
      <CardHeader
        icon={CalendarDays}
        eyebrow="Today's schedule"
        title="On today's calendar"
        action={
          <Badge tone="neutral" className="tnum">{items.length} things</Badge>
        }
      />
      <div className="px-5 py-4 sm:px-6">
        {items.map((item, index) => (
          <div key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
            {index < items.length - 1 && (
              <span className="absolute left-[5px] top-4 bottom-0 w-px bg-[#E4E4E7]" />
            )}
            <span className={`relative z-10 mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-white ${ACCENTS[item.accent] ?? ACCENTS.indigo}`} />
            <div className={`min-w-0 flex-1 rounded-xl px-2 py-1.5 -mx-2 ${item.current ? 'bg-[#EEF2FF]/70' : ''}`}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="tnum text-[11px] font-semibold text-[#4F46E5]">
                  {item.time} <span className="text-[9px] text-[#A1A1AA]">{item.meridiem}</span>
                </p>
                <Badge tone={item.current ? 'indigo' : 'neutral'}>{item.tag}</Badge>
              </div>
              <p className="mt-1 text-[12px] font-semibold leading-snug text-[#09090B]">{item.title}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#A1A1AA]">
                {item.meta.startsWith('Zoom') || item.meta.includes('min') ? (
                  <Clock size={10} />
                ) : (
                  <MapPin size={10} />
                )}
                {item.meta}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
