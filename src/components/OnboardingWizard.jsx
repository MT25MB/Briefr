import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Car,
  Check,
  Cpu,
  Globe2,
  House,
  Info,
  Lock,
  MapPin,
  Rss,
  Trash2,
  TrainFront,
  TrendingUp,
  X,
} from 'lucide-react'
import BrandMark from './BrandMark.jsx'
import { Segmented } from './ui.jsx'
import { KeyEditor } from './KeyManagerModal.jsx'
import ProviderGuides from './ProviderGuides.jsx'
import LocationSearch from './LocationSearch.jsx'
import { TOPIC_PACKS } from '../lib/mockDigest.js'
import { COVERAGE_MODES, POLITICAL_LENSES } from '../lib/storage.js'

const STEPS = ['Free AI keys', 'Your details', 'What you follow']
const SENSITIVITIES = ['Runs Cold', 'Normal', 'Runs Warm']
const COMMUTES = [
  { label: 'Walk / Transit', icon: TrainFront, note: 'Mostly on foot or by train' },
  { label: 'Drive', icon: Car, note: 'Mostly in the car' },
  { label: 'Work from Home', icon: House, note: 'Mostly indoors at home' },
]
const TOPIC_ICONS = { MapPin, Cpu, Globe2, TrendingUp }

export default function OnboardingWizard({
  settings,
  onChange,
  onClose,
  onPing,
  onSimulateRateLimit,
}) {
  const [step, setStep] = useState(1)
  const [rssInput, setRssInput] = useState('')

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const toggleTopic = (topic) => {
    onChange({
      topics: settings.topics.includes(topic)
        ? settings.topics.filter((item) => item !== topic)
        : [...settings.topics, topic],
    })
  }

  const addFeed = () => {
    const url = rssInput.trim()
    if (!url) return
    onChange({ feeds: [...settings.feeds, url] })
    setRssInput('')
  }

  const finish = () => {
    onChange({ onboardingDone: true })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#09090B]/45 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Briefr setup"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-[#F4F4F5] px-5 py-4 sm:px-7">
          <BrandMark size={32} />
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold tracking-tight text-[#09090B]">Set up Briefr</h2>
            <p className="text-[11px] text-[#71717A]">Three quick steps. You can change any of this later.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close setup"
            className="rounded-lg p-1.5 text-[#A1A1AA] hover:bg-[#F4F4F5] hover:text-[#52525B]"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex gap-2 border-b border-[#F4F4F5] px-5 py-3 sm:gap-3 sm:px-7">
          {STEPS.map((label, index) => {
            const number = index + 1
            const active = step === number
            const done = step > number
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStep(number)}
                className={`flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                  active ? 'bg-[#EEF2FF]' : 'hover:bg-[#FAFAFA]'
                }`}
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    active || done ? 'bg-[#4F46E5] text-white' : 'bg-[#F4F4F5] text-[#A1A1AA]'
                  }`}
                >
                  {done ? <Check size={11} /> : number}
                </span>
                <span className={`hidden truncate text-[11px] font-semibold sm:inline ${active ? 'text-[#3730A3]' : 'text-[#A1A1AA]'}`}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {step === 1 && (
            <div>
              <h3 className="text-[17px] font-semibold tracking-tight text-[#09090B]">Connect a free AI helper</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-[#52525B]">
                Pick any provider below. Keys are optional — the weather and offline wardrobe rules work
                with zero keys. Add several to keep the briefing running when one runs out.
              </p>

              <div className="mt-4">
                <ProviderGuides />
              </div>

              <div className="mt-5 rounded-xl border border-[#E4E4E7] bg-white p-4">
                <KeyEditor
                  keys={settings.keys}
                  onChange={(keys) => onChange({ keys })}
                  onPing={onPing}
                  onSimulateRateLimit={onSimulateRateLimit}
                  compact
                />
                <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-snug text-[#A1A1AA]">
                  <Lock size={11} className="mt-0.5 shrink-0" />
                  Keys are stored in this browser's localStorage. Nothing is sent to a Briefr server —
                  there isn't one.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="text-[17px] font-semibold tracking-tight text-[#09090B]">Where you are</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-[#52525B]">
                This is how Briefr decides whether "54°" means a light jacket or a heavy coat.
              </p>

              <div className="mt-5 rounded-xl border border-[#E4E4E7] p-4">
                <label htmlFor="location" className="flex items-center gap-1.5 text-[12px] font-semibold text-[#09090B]">
                  <MapPin size={13} className="text-[#4F46E5]" /> City or ZIP code
                </label>
                <div className="mt-2">
                  <LocationSearch
                    id="location"
                    value={settings.location}
                    onChange={(location) => onChange({ location })}
                  />
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[#E4E4E7] p-4">
                <p className="text-[12px] font-semibold text-[#09090B]">How do you feel the cold?</p>
                <p className="mt-0.5 text-[11px] text-[#A1A1AA]">No judgment — this tunes the outfit advice.</p>
                <Segmented
                  options={SENSITIVITIES}
                  value={settings.sensitivity}
                  onChange={(value) => onChange({ sensitivity: value })}
                  className="mt-3 w-full sm:w-auto"
                />
              </div>

              <div className="mt-4 rounded-xl border border-[#E4E4E7] p-4">
                <p className="text-[12px] font-semibold text-[#09090B]">How do you get around?</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {COMMUTES.map((item) => {
                    const Icon = item.icon
                    const active = settings.commute === item.label
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => onChange({ commute: item.label })}
                        className={`rounded-xl border p-3 text-left transition-colors ${
                          active ? 'border-[#4F46E5] bg-[#EEF2FF]' : 'border-[#E4E4E7] hover:bg-[#FAFAFA]'
                        }`}
                      >
                        <Icon size={16} className={active ? 'text-[#4F46E5]' : 'text-[#71717A]'} />
                        <p className={`mt-2 text-[11px] font-semibold ${active ? 'text-[#3730A3]' : 'text-[#09090B]'}`}>
                          {item.label}
                        </p>
                        <p className="mt-0.5 text-[10px] leading-snug text-[#A1A1AA]">{item.note}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="text-[17px] font-semibold tracking-tight text-[#09090B]">What should we follow?</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-[#52525B]">
                Start with a pack or two. Briefr merges duplicate headlines so you see each story once.
              </p>

              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {TOPIC_PACKS.map((pack) => {
                  const Icon = TOPIC_ICONS[pack.icon] ?? Globe2
                  const active = settings.topics.includes(pack.id)
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => toggleTopic(pack.id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                        active ? 'border-[#4F46E5] bg-[#EEF2FF]' : 'border-[#E4E4E7] hover:bg-[#FAFAFA]'
                      }`}
                    >
                      <span className={`flex size-8 items-center justify-center rounded-lg ${active ? 'bg-white text-[#4F46E5]' : 'bg-[#F4F4F5] text-[#71717A]'}`}>
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[12px] font-semibold ${active ? 'text-[#3730A3]' : 'text-[#09090B]'}`}>
                          {pack.label}
                        </span>
                        <span className="block text-[10px] text-[#A1A1AA]">{pack.detail}</span>
                      </span>
                      <span className={`flex size-4 items-center justify-center rounded border ${active ? 'border-[#4F46E5] bg-[#4F46E5] text-white' : 'border-[#D4D4D8]'}`}>
                        {active && <Check size={10} />}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 rounded-xl border border-[#E4E4E7] p-4">
                <p className="text-[12px] font-semibold text-[#09090B]">News lens (optional)</p>
                <p className="mt-1 text-[11px] leading-snug text-[#71717A]">
                  If you want, tell Briefr how to frame the news. This only changes which stories get
                  ranked higher and how they're summarized. Weather and schedule never change.
                </p>
                <select
                  aria-label="Political news lens"
                  value={settings.politicalLens ?? 'Neutral / Balanced'}
                  onChange={(event) => onChange({ politicalLens: event.target.value })}
                  className="mt-3 w-full rounded-lg border border-[#E4E4E7] px-3 py-2 text-[11px] focus:border-[#A5B4FC] focus:outline-none"
                >
                  {POLITICAL_LENSES.map((lens) => (
                    <option key={lens} value={lens}>{lens}</option>
                  ))}
                </select>
                {settings.politicalLens !== 'Neutral / Balanced' &&
                  settings.politicalLens !== 'None / Unfiltered' && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {COVERAGE_MODES.map((mode) => {
                        const active = (settings.coverageMode ?? 'Balanced / Both Sides') === mode
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => onChange({ coverageMode: mode })}
                            className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${
                              active
                                ? 'border-[#4F46E5] bg-[#EEF2FF] text-[#4F46E5]'
                                : 'border-[#E4E4E7] text-[#71717A]'
                            }`}
                          >
                            {mode}
                          </button>
                        )
                      })}
                    </div>
                  )}
                <p className="mt-2 text-[10px] leading-snug text-[#A1A1AA]">
                  Stored with your account preferences. You can change or clear it any time in settings.
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-[#E4E4E7] p-4">
                <label htmlFor="rss" className="flex items-center gap-1.5 text-[12px] font-semibold text-[#09090B]">
                  <Rss size={13} className="text-[#4F46E5]" /> Add your own news feed (optional)
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="rss"
                    value={rssInput}
                    onChange={(event) => setRssInput(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && addFeed()}
                    placeholder="https://example.com/feed.xml"
                    className="min-w-0 flex-1 rounded-lg border border-[#E4E4E7] px-3 py-2 text-[12px] placeholder:text-[#A1A1AA] focus:border-[#A5B4FC] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/10"
                  />
                  <button
                    type="button"
                    onClick={addFeed}
                    disabled={!rssInput.trim()}
                    className="rounded-lg bg-[#F4F4F5] px-3 py-2 text-[11px] font-semibold text-[#3F3F46] hover:bg-[#E4E4E7] disabled:opacity-40"
                  >
                    Add feed
                  </button>
                </div>
                {settings.feeds.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-[#F4F4F5] pt-3">
                    {settings.feeds.map((feed) => (
                      <div key={feed} className="flex items-center gap-2 text-[11px] text-[#52525B]">
                        <Rss size={11} className="shrink-0 text-[#A1A1AA]" />
                        <span className="min-w-0 flex-1 truncate">{feed}</span>
                        <button
                          type="button"
                          onClick={() => onChange({ feeds: settings.feeds.filter((item) => item !== feed) })}
                          aria-label={`Remove ${feed}`}
                          className="text-[#A1A1AA] hover:text-[#BE123C]"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-snug text-[#A1A1AA]">
                  <Info size={11} className="mt-0.5 shrink-0" />
                  We'll save your feed here and check it on your next morning run.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#F4F4F5] bg-[#FCFCFD] px-5 py-3.5 sm:px-7">
          <button
            type="button"
            onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#09090B]"
          >
            <ArrowLeft size={13} /> {step === 1 ? 'Skip for now' : 'Back'}
          </button>
          <span className="tnum text-[10px] text-[#A1A1AA]">Step {step} of 3</span>
          <button
            type="button"
            onClick={() => (step === 3 ? finish() : setStep(step + 1))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F46E5] px-3.5 py-2 text-[11px] font-semibold text-white hover:bg-[#4338CA]"
          >
            {step === 3 ? 'Finish setup' : 'Continue'} <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
