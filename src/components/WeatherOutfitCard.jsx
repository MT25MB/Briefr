import { useState } from 'react'
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Loader2,
  MapPin,
  Snowflake,
  Sparkles,
  Sun,
  Wind,
} from 'lucide-react'
import { Badge, Card, CardHeader } from './ui.jsx'

const ICONS = {
  sun: Sun,
  cloudSun: CloudSun,
  cloud: Cloud,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
  fog: CloudFog,
}

function WeatherIcon({ kind, size = 16, className = '' }) {
  const Icon = ICONS[kind] ?? Cloud
  return <Icon size={size} className={className} strokeWidth={1.8} />
}

function Metric({ icon: Icon, label, value }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] px-2 py-1 text-[10px] text-[#71717A]">
      <Icon size={11} className="shrink-0 text-[#A1A1AA]" />
      <span>{label}</span>
      <span className="tnum font-semibold text-[#3F3F46]">{value}</span>
    </span>
  )
}

export default function WeatherOutfitCard({
  weather,
  wardrobe,
  source = 'mock',
  wardrobeSource = 'deterministic',
  loading = false,
  error = null,
  preferences = {},
}) {
  const [selected, setSelected] = useState(0)
  const selectedHour = weather.hourly[Math.min(selected, Math.max(weather.hourly.length - 1, 0))]

  return (
    <Card>
      <CardHeader
        icon={CloudSun}
        eyebrow="Weather & wardrobe"
        title="Today outside"
        action={
          <span className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] text-[#A1A1AA]">
              <MapPin size={10} /> {weather.locationLabel}
            </span>
            <Badge tone={source === 'live' ? 'emerald' : 'neutral'}>{source === 'live' ? 'Live' : 'Sample'}</Badge>
          </span>
        }
      />

      <div className="px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <WeatherIcon kind={weather.current.icon} size={44} className="-mt-1 text-[#4F46E5]" />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="tnum text-[46px] font-semibold leading-none tracking-[-0.05em] text-[#09090B]">
                  {weather.current.temp}°
                </span>
                <span className="tnum text-[11px] font-medium text-[#71717A]">
                  Feels {weather.current.feelsLike}°
                </span>
              </div>
              <p className="mt-1 text-[12px] text-[#52525B]">{weather.current.condition}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="tnum text-[12px] text-[#71717A]">
              <span className="font-semibold text-[#09090B]">H {weather.high}°</span>
              <span className="mx-1.5 text-[#D4D4D8]">/</span>L {weather.low}°
            </p>
            <p className="mt-1 text-[10px] text-[#A1A1AA]">Updated {weather.updatedAt}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Metric icon={Wind} label="Wind" value={`${weather.current.wind} mph`} />
          <Metric icon={Droplets} label="Rain" value={`${weather.current.precip}%`} />
          <Metric icon={Snowflake} label="Snow" value={`${weather.current.snowfall} in`} />
        </div>

        {wardrobe.precipAlert && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-[#C7D2FE] bg-[#EEF2FF]/70 px-3 py-2.5 text-[11px] font-medium leading-snug text-[#3730A3]">
            <CloudRain size={14} className="mt-0.5 shrink-0 text-[#4F46E5]" />
            {wardrobe.precipAlert}
          </p>
        )}
        {wardrobe.dayNotes && (
          <p className="mt-2 flex items-start gap-2 rounded-xl border border-[#E4E4E7] bg-white px-3 py-2.5 text-[11px] leading-snug text-[#52525B]">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-[#4F46E5]" />
            {wardrobe.dayNotes}
          </p>
        )}

        <div className="mt-5 rounded-xl border border-[#F4F4F5] bg-[#FAFAFA]">
          <div className="flex items-center justify-between gap-2 px-3 pt-3">
            <span className="text-[11px] font-semibold text-[#52525B]">Next 24 hours</span>
            <span className="hidden text-[10px] text-[#A1A1AA] sm:inline">Tap an hour for details</span>
          </div>
          <div className="no-scrollbar flex gap-0.5 overflow-x-auto px-2 pb-2 pt-2">
            {weather.hourly.map((hour, index) => {
              const active = index === Math.min(selected, weather.hourly.length - 1)
              return (
                <button
                  key={hour.iso}
                  type="button"
                  onClick={() => setSelected(index)}
                  aria-label={`${hour.time}, ${hour.temp} degrees, ${hour.precip}% chance of rain`}
                  className={`flex min-w-[58px] flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40 ${
                    active ? 'bg-white ring-1 ring-[#C7D2FE]' : 'hover:bg-white/70'
                  }`}
                >
                  <span className="tnum text-[10px] text-[#A1A1AA]">{hour.time}</span>
                  <WeatherIcon kind={hour.icon} className={hour.precip >= 50 ? 'text-[#4F46E5]' : 'text-[#71717A]'} />
                  <span className="tnum text-[12px] font-semibold text-[#09090B]">{hour.temp}°</span>
                  <div className="h-1 w-8 overflow-hidden rounded-full bg-[#E4E4E7]">
                    <div
                      className={`h-full rounded-full ${hour.precip >= 50 ? 'bg-[#4F46E5]' : 'bg-[#A5B4FC]'}`}
                      style={{ width: `${Math.max(hour.precip, 3)}%` }}
                    />
                  </div>
                  <span className="tnum text-[10px] text-[#A1A1AA]">{hour.precip ? `${hour.precip}%` : '—'}</span>
                </button>
              )
            })}
          </div>
          {selectedHour && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#E4E4E7] px-3 py-2 text-[10px] text-[#71717A]">
              <span className="font-semibold text-[#3F3F46]">{selectedHour.time} detail</span>
              <span>{selectedHour.condition}</span>
              <span className="tnum">Feels {selectedHour.feelsLike}°</span>
              <span className="tnum">Rain {selectedHour.precip}% · {selectedHour.precipitation} in</span>
              <span className="tnum">Snow {selectedHour.snowfall} in</span>
              <span className="tnum">Wind {selectedHour.wind} mph</span>
            </div>
          )}
        </div>

        <div className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-[#09090B]">
              <Sparkles size={14} className="text-[#4F46E5]" /> What to wear, by time of day
            </h3>
            <div className="flex items-center gap-1.5">
              {loading && <Loader2 size={12} className="animate-spin text-[#4F46E5]" />}
              <Badge tone={wardrobeSource === 'ai' ? 'indigo' : 'neutral'}>
                {wardrobeSource === 'ai' ? 'With AI' : 'Built-in'}
              </Badge>
              <Badge className="hidden sm:inline-flex">
                {preferences.sensitivity ?? 'Normal'} · {preferences.commute ?? 'Walk / Transit'}
              </Badge>
            </div>
          </div>

          <p className="mb-3 text-[11px] font-medium leading-snug text-[#52525B]">{wardrobe.headline}</p>

          <div>
            {wardrobe.wardrobeTimeline.map((entry, index) => {
              const window = weather.windows[index]
              const icon = window?.icon ?? 'cloudSun'
              const alertTone =
                window?.precipMax >= 60
                  ? 'bg-[#FFF1F2] text-[#BE123C]'
                  : window?.precipMax >= 20
                    ? 'bg-[#FFFBEB] text-[#B45309]'
                    : 'bg-[#ECFDF5] text-[#047857]'
              return (
                <div key={entry.timeWindow ?? index} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < wardrobe.wardrobeTimeline.length - 1 && (
                    <span className="absolute left-[15px] top-9 bottom-0 w-px bg-[#E4E4E7]" />
                  )}
                  <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${alertTone}`}>
                    <WeatherIcon kind={icon} size={15} />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[13px] font-semibold text-[#09090B]">{entry.timeWindow}</span>
                      <span className="tnum text-[10px] text-[#A1A1AA]">{window?.timeWindow}</span>
                      <Badge tone="neutral" className="ml-auto">{window?.precipMax ?? 0}% rain</Badge>
                    </div>
                    <p className="tnum mt-1.5 text-[10px] text-[#A1A1AA]">{entry.tempSummary}</p>
                    <p className="mt-1.5 text-[12px] leading-[1.55] text-[#52525B]">{entry.outfit}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {entry.gearTags.map((tag) => (
                        <span key={tag} className="rounded-md border border-[#E4E4E7] bg-white px-1.5 py-0.5 text-[10px] text-[#71717A]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <p className="mt-5 border-t border-[#F4F4F5] pt-3 text-[10px] leading-snug text-[#A1A1AA]">
          {wardrobeSource === 'ai'
            ? 'Outfit advice made just for this forecast.'
            : 'Built-in advice for now. Add an AI key in settings for more personal tips.'}
          {source === 'mock' && ' Showing sample weather.'}
          {error && ` Couldn't get live weather: ${error}`}
        </p>
      </div>
    </Card>
  )
}
