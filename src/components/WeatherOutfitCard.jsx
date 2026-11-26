import { useState } from 'react'
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from 'lucide-react'
import { Card, CardHeader } from './ui.jsx'

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
  return <Icon size={size} className={className} strokeWidth={1.6} aria-hidden="true" />
}

function Metric({ label, value }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="metadata">{label}</span>
      <span className="tnum text-[0.875rem] font-semibold text-[var(--ink)]">{value}</span>
    </span>
  )
}

export default function WeatherOutfitCard({
  weather,
  wardrobe,
  error = null,
  preferences = {},
}) {
  const [selected, setSelected] = useState(0)
  const selectedHour = weather.hourly[Math.min(selected, Math.max(weather.hourly.length - 1, 0))]

  return (
    <Card>
      <CardHeader
        title="Weather & outfit"
        action={
          <p className="metadata min-w-0 truncate">{weather.locationLabel}</p>
        }
      />

      <div className="px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <WeatherIcon kind={weather.current.icon} size={48} className="-mt-1 text-[var(--accent)]" />
            <div>
              <div className="flex items-baseline gap-3">
                <span className="tnum font-display text-[2.75rem] font-semibold leading-none tracking-[-0.04em] text-[var(--ink)]">
                  {weather.current.temp}°
                </span>
                <span className="metadata tnum">Feels {weather.current.feelsLike}°</span>
              </div>
              <p className="body-copy mt-2">{weather.current.condition}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="tnum text-[0.875rem] text-[var(--muted)]">
              <span className="font-semibold text-[var(--ink)]">H {weather.high}°</span>
              <span className="mx-1.5 text-[var(--line-strong)]" aria-hidden="true">/</span>L {weather.low}°
            </p>
            <p className="metadata tnum mt-1">Updated {weather.updatedAt}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
          <Metric label="Wind" value={`${weather.current.wind} mph`} />
          <Metric label="Rain" value={`${weather.current.precip}%`} />
          <Metric label="Snow" value={`${weather.current.snowfall} in`} />
        </div>

        {wardrobe.precipAlert && (
          <p className="mt-5 border-l-2 border-[var(--warning-line)] pl-4 text-[0.875rem] leading-relaxed text-[var(--warning)]">
            {wardrobe.precipAlert}
          </p>
        )}
        <section className="mt-6" aria-label="Hourly outlook">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="reading-title">Next 24 hours</h3>
            <p className="metadata hidden sm:block">Tap an hour for detail</p>
          </div>
          <div className="no-scrollbar mt-3 flex gap-1 overflow-x-auto pb-1">
            {weather.hourly.map((hour, index) => {
              const active = index === Math.min(selected, weather.hourly.length - 1)
              return (
                <button
                  key={hour.iso}
                  type="button"
                  onClick={() => setSelected(index)}
                  aria-pressed={active}
                  aria-label={`${hour.time}, ${hour.temp} degrees, ${hour.precip}% chance of rain`}
                  className={`flex min-h-16 min-w-[58px] flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 ${
                    active ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--paper)]'
                  }`}
                >
                  <span className="metadata tnum">{hour.time}</span>
                  <WeatherIcon kind={hour.icon} className={hour.precip >= 50 ? 'text-[var(--accent)]' : 'text-[var(--faint)]'} />
                  <span className="tnum text-[0.875rem] font-semibold text-[var(--ink)]">{hour.temp}°</span>
                  <span className="metadata tnum">{hour.precip ? `${hour.precip}%` : '—'}</span>
                </button>
              )
            })}
          </div>
          {selectedHour && (
            <p className="metadata tnum mt-3 flex flex-wrap gap-x-4 gap-y-1">
              <span className="font-semibold text-[var(--muted)]">{selectedHour.time}</span>
              <span>{selectedHour.condition}</span>
              <span>Feels {selectedHour.feelsLike}°</span>
              <span>Rain {selectedHour.precip}% · {selectedHour.precipitation} in</span>
              <span>Snow {selectedHour.snowfall} in</span>
              <span>Wind {selectedHour.wind} mph</span>
            </p>
          )}
        </section>

        <section className="mt-8">
          <h3 className="section-title">What to wear, by time of day</h3>
          <p className="body-copy mt-3 max-w-prose">{wardrobe.headline}</p>

          <ol className="mt-5">
            {wardrobe.wardrobeTimeline.map((entry, index) => {
              const window = weather.windows[index]
              return (
                <li key={entry.timeWindow ?? index} className="flex gap-4 py-4">
                  <span className="metadata w-20 shrink-0 pt-0.5 font-semibold text-[var(--muted)]">{entry.timeWindow}</span>
                  <div className="min-w-0 flex-1">
                    <p className="metadata tnum">{window?.precipMax ?? 0}% rain · {entry.tempSummary}</p>
                    <p className="mt-2 max-w-prose text-[0.9375rem] leading-relaxed text-[var(--ink)]">{entry.outfit}</p>
                    {entry.gearTags.length > 0 && (
                      <p className="metadata mt-2">{entry.gearTags.join(' · ')}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        {(error || (preferences.sensitivity && preferences.sensitivity !== 'Normal')) && (
          <p className="metadata mt-6">
            {error && `Couldn't get live weather: ${error}. `}
            {preferences.sensitivity && preferences.sensitivity !== 'Normal' && `Tuned for ${preferences.sensitivity.toLowerCase()}.`}
          </p>
        )}
      </div>
    </Card>
  )
}
