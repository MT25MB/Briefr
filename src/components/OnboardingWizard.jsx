import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Car,
  Check,
  Cpu,
  Globe2,
  House,
  Info,
  MapPin,
  Rss,
  Trash2,
  TrainFront,
  TrendingUp,
} from 'lucide-react'
import BrandMark from './BrandMark.jsx'
import Modal from './Modal.jsx'
import { Segmented } from './ui.jsx'
import { KeyEditor } from './KeyManagerModal.jsx'
import ProviderGuides from './ProviderGuides.jsx'
import LocationSearch from './LocationSearch.jsx'
import { TOPIC_PACKS } from '../lib/mockDigest.js'
import {
  COVERAGE_MODES,
  COVERAGE_MODE_LABELS,
  POLITICAL_LENSES,
  POLITICAL_LENS_LABELS,
} from '../lib/storage.js'

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

  const toggleTopic = (topic) => {
    onChange({
      topics: settings.topics.includes(topic)
        ? settings.topics.filter((item) => item !== topic)
        : [...settings.topics, topic],
    })
  }

  const setLens = (lens) => {
    onChange({
      politicalLens: lens,
      ...(lens === 'neutral' ? {} : { savedPoliticalLens: lens }),
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

  const nextLabel = ['Next: your details', 'Next: news', 'Finish setup'][step - 1]

  const footer = (
    <>
      <button
        type="button"
        onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
        className="inline-flex min-h-12 items-center gap-1.5 text-[0.875rem] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
      >
        <ArrowLeft size={14} /> {step === 1 ? 'Skip for now' : 'Back'}
      </button>
      <span className="metadata tnum">Step {step} of 3</span>
      <button
        type="button"
        onClick={() => (step === 3 ? finish() : setStep(step + 1))}
        className="primary-button"
      >
        {nextLabel} <ArrowRight size={14} />
      </button>
    </>
  )

  return (
    <Modal
      label="Briefr setup"
      title="Set up Briefr"
      description="Three quick steps. Change any of this later."
      icon={<BrandMark size={32} />}
      size="lg"
      onClose={onClose}
      footer={footer}
    >
      <div className="-mx-5 flex gap-4 border-b border-[var(--line)] px-5 pb-3 sm:-mx-7 sm:gap-6 sm:px-7">
          {STEPS.map((label, index) => {
            const number = index + 1
            const active = step === number
            const done = step > number
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStep(number)}
                aria-current={active ? 'step' : undefined}
                className={`-mb-px flex min-h-14 flex-1 items-center gap-2 border-b-2 text-left text-[0.875rem] font-semibold transition-colors ${
                  active ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--faint)] hover:text-[var(--ink)]'
                }`}
              >
                <span className="tnum text-[0.8125rem]">{done ? <Check size={14} aria-hidden="true" /> : `0${number}`}</span>
                <span className="truncate">{label}</span>
              </button>
            )
          })}
        </div>

        <div className="pt-6">
          {step === 1 && (
            <div>
              <h3 className="section-title">Connect a free AI helper</h3>
              <p className="body-copy mt-2">
                Keys are optional. Weather and outfit advice work without one. Add a few so the briefing
                keeps going when a provider hits its limit.
              </p>

              <div className="mt-4">
                <ProviderGuides />
              </div>

              <div className="mt-6 border-t border-[var(--line)] pt-5">
                <KeyEditor
                  keys={settings.keys}
                  onChange={(keys) => onChange({ keys })}
                  onPing={onPing}
                  onSimulateRateLimit={onSimulateRateLimit}
                  compact
                />
                <p className="metadata mt-3">Keys stay on this device. Briefr has no server for them.</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="section-title">Where you are</h3>
              <p className="mt-1 text-[0.875rem] leading-relaxed text-[var(--muted)]">
                This is how Briefr decides whether "54°" means a light jacket or a heavy coat.
              </p>

              <div className="mt-6 border-t border-[var(--line)] pt-5">
                <label htmlFor="location" className="flex items-center gap-1.5 text-[0.875rem] font-semibold text-[var(--ink)]">
                  <MapPin size={13} className="text-[var(--accent)]" /> City or ZIP code
                </label>
                <div className="mt-2">
                  <LocationSearch
                    id="location"
                    value={settings.location}
                    onChange={(location) => onChange({ location })}
                  />
                </div>
              </div>

              <div className="mt-5 border-t border-[var(--line)] pt-5">
                <p className="text-[0.875rem] font-semibold text-[var(--ink)]">How do you feel the cold?</p>
                <p className="mt-0.5 text-[0.8125rem] text-[var(--faint)]">No judgment. This tunes the outfit advice.</p>
                <Segmented
                  options={SENSITIVITIES}
                  value={settings.sensitivity}
                  onChange={(value) => onChange({ sensitivity: value })}
                  className="mt-3 w-full sm:w-auto"
                />
              </div>

              <div className="mt-5 border-t border-[var(--line)] pt-5">
                <p className="text-[0.875rem] font-semibold text-[var(--ink)]">How do you get around?</p>
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
                          active ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line)] hover:bg-[var(--paper)]'
                        }`}
                      >
                        <Icon size={16} className={active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'} />
                        <p className={`mt-2 text-[0.8125rem] font-semibold ${active ? 'text-[var(--accent-deep)]' : 'text-[var(--ink)]'}`}>
                          {item.label}
                        </p>
                        <p className="mt-0.5 text-[0.75rem] leading-snug text-[var(--faint)]">{item.note}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="section-title">What should we follow?</h3>
              <p className="mt-1 text-[0.875rem] leading-relaxed text-[var(--muted)]">
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
                        active ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line)] hover:bg-[var(--paper)]'
                      }`}
                    >
                      <span className={`flex size-8 items-center justify-center rounded-lg ${active ? 'bg-[var(--surface)] text-[var(--accent)]' : 'bg-[var(--line-soft)] text-[var(--muted)]'}`}>
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[0.875rem] font-semibold ${active ? 'text-[var(--accent-deep)]' : 'text-[var(--ink)]'}`}>
                          {pack.label}
                        </span>
                        <span className="block text-[0.75rem] text-[var(--faint)]">{pack.detail}</span>
                      </span>
                      <span className={`flex size-4 items-center justify-center rounded border ${active ? 'border-[var(--accent)] bg-[var(--accent-action)] text-white' : 'border-[var(--line-strong)]'}`}>
                        {active && <Check size={10} />}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-5 border-t border-[var(--line)] pt-5">
                <p className="reading-title">Political lens (optional)</p>
                <p className="metadata mt-1">
                  Choose a general leaning if you want news framed for it. This only changes news selection and framing. Weather, calendar, and factual claims never change. Skip this and keep a neutral briefing.
                </p>
                <label htmlFor="political-lens" className="sr-only">Political news lens</label>
                <select
                  id="political-lens"
                  aria-label="Political news lens"
                  value={settings.politicalLens ?? 'neutral'}
                  onChange={(event) => setLens(event.target.value)}
                  className="field mt-3 min-h-12"
                >
                  {POLITICAL_LENSES.map((lens) => (
                    <option key={lens} value={lens}>{POLITICAL_LENS_LABELS[lens]}</option>
                  ))}
                </select>
                {settings.politicalLens !== 'neutral' && settings.politicalLens !== 'unfiltered' && (
                  <div className="mt-3">
                    <p className="metadata">Coverage</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {COVERAGE_MODES.map((mode) => {
                        const active = (settings.coverageMode ?? 'balanced') === mode
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => onChange({ coverageMode: mode })}
                            aria-pressed={active}
                            className={`inline-flex min-h-12 items-center border-b-2 px-2 text-[0.875rem] font-semibold ${
                              active ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--muted)]'
                            }`}
                          >
                            {COVERAGE_MODE_LABELS[mode]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                <p className="metadata mt-3">
                  Saved with your preferences. Switch between this lens and Neutral from the news card at any time.
                </p>
              </div>

              <div className="mt-5 border-t border-[var(--line)] pt-5">
                <label htmlFor="rss" className="flex items-center gap-1.5 text-[0.875rem] font-semibold text-[var(--ink)]">
                  <Rss size={13} className="text-[var(--accent)]" /> Add your own news feed (optional)
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="rss"
                    value={rssInput}
                    onChange={(event) => setRssInput(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && addFeed()}
                    placeholder="https://example.com/feed.xml"
                    className="field min-h-12 min-w-0 flex-1"
                  />
                  <button
                    type="button"
                    onClick={addFeed}
                    disabled={!rssInput.trim()}
                    className="quiet-button disabled:opacity-40"
                  >
                    Add feed
                  </button>
                </div>
                {settings.feeds.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-[var(--line-soft)] pt-3">
                    {settings.feeds.map((feed) => (
                      <div key={feed} className="flex items-center gap-2 text-[0.8125rem] text-[var(--muted)]">
                        <Rss size={11} className="shrink-0 text-[var(--faint)]" />
                        <span className="min-w-0 flex-1 truncate">{feed}</span>
                        <button
                          type="button"
                          onClick={() => onChange({ feeds: settings.feeds.filter((item) => item !== feed) })}
                          aria-label={`Remove ${feed}`}
                          className="text-[var(--faint)] hover:text-[var(--danger)]"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-3 flex items-start gap-1.5 text-[0.75rem] leading-snug text-[var(--faint)]">
                  <Info size={11} className="mt-0.5 shrink-0" />
                  We'll save your feed here and check it on your next morning run.
                </p>
              </div>
            </div>
          )}
        </div>
    </Modal>
  )
}
