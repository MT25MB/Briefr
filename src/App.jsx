import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, Sparkles, X } from 'lucide-react'
import TopNav from './components/TopNav.jsx'
import WeatherOutfitCard from './components/WeatherOutfitCard.jsx'
import NewsFeedCard from './components/NewsFeedCard.jsx'
import ScheduleCard from './components/ScheduleCard.jsx'
import TriageCard from './components/TriageCard.jsx'
import OnboardingWizard from './components/OnboardingWizard.jsx'
import KeyManagerModal from './components/KeyManagerModal.jsx'
import CalendarSourcesModal from './components/CalendarSourcesModal.jsx'
import AccountModal from './components/AccountModal.jsx'
import RotationStatusBanner from './components/RotationStatusBanner.jsx'
import { digest, mockCalendarEvents, mockWeather } from './lib/mockDigest.js'
import {
  DEFAULT_PREFS,
  clearAllStorage,
  digestCacheKey,
  loadCalendars,
  loadKeys,
  loadPrefs,
  saveCalendars,
  saveKeys,
  savePrefs,
  todayKey,
} from './lib/storage.js'
import { applyRateLimit, getKeyStatus, isKeyEligible, pingKey, runWithRotation } from './lib/llmRotator.js'
import { buildFallbackWardrobe, buildTriagePrompt, triageLocally } from './lib/prompts.js'
import { buildBriefingScript } from './lib/audioBriefing.js'
import { MOCK_NEWS_ITEMS, runMorningBriefing } from './lib/digestRunner.js'
import { getCurrentAccount } from './lib/accountService.js'
import {
  clearOAuthProvider,
  completeGoogleOAuth,
  completeNotionOAuth,
  getOAuthProvider,
  getTodaysEvents,
} from './lib/calendarService.js'

const TOAST_TONES = {
  ok: 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]',
  warn: 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]',
  neutral: 'border-[#E4E4E7] bg-white text-[#3F3F46]',
}

const SYSTEM_PROMPT =
  'You are Briefr, a calm morning briefing assistant. Return strict JSON only, with no markdown or commentary.'

const TODAY = todayKey()

export default function App() {
  const [prefs, setPrefs] = useState(loadPrefs)
  const [keys, setKeys] = useState(loadKeys)
  const [showWizard, setShowWizard] = useState(false)
  const [showKeyManager, setShowKeyManager] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState(null)
  const [calendarNonce, setCalendarNonce] = useState(0)
  const runCounterRef = useRef(0)

  const [weather, setWeather] = useState(mockWeather)
  const [weatherMeta, setWeatherMeta] = useState({ source: 'mock', loading: false, error: null })
  const [wardrobe, setWardrobe] = useState(() =>
    buildFallbackWardrobe(mockWeather, {
      sensitivity: prefs.sensitivity,
      commute: prefs.commute,
      tone: prefs.tone,
    }),
  )
  const [wardrobeLoading, setWardrobeLoading] = useState(false)
  const [rotationMeta, setRotationMeta] = useState(null)

  const [rawNews, setRawNews] = useState([])
  const [newsDigest, setNewsDigest] = useState(null)
  const [newsSource, setNewsSource] = useState('raw')
  const [newsRankMeta, setNewsRankMeta] = useState(null)
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsMeta, setNewsMeta] = useState({ errors: [], sourceCount: 0 })

  const [audioState, setAudioState] = useState(() =>
    'speechSynthesis' in window ? 'idle' : 'unsupported',
  )
  const utteranceRef = useRef(null)

  const [triageResult, setTriageResult] = useState(null)
  const [triageLoading, setTriageLoading] = useState(false)
  const [triageSource, setTriageSource] = useState('rules')

  const [calendars, setCalendars] = useState(loadCalendars)
  const [showCalendars, setShowCalendars] = useState(false)
  const [events, setEvents] = useState([])
  const [calendarMeta, setCalendarMeta] = useState({ loading: false, errors: [], connected: false })

  const [account, setAccount] = useState(getCurrentAccount)
  const [showAccount, setShowAccount] = useState(false)

  const settings = { ...prefs, keys }

  const setKeysAndSave = useCallback((next) => {
    saveKeys(next)
    setKeys(next)
  }, [])

  const setCalendarsAndSave = useCallback((next) => {
    saveCalendars(next)
    setCalendars(next)
  }, [])

  const handleAccountChange = useCallback((next) => {
    setAccount(next)
    setPrefs(loadPrefs())
    setKeys(loadKeys())
    setCalendars(loadCalendars())
    setRotationMeta(null)
    setNewsDigest(null)
    setNewsSource('raw')
    setBannerDismissed(false)
    setCalendarNonce((value) => value + 1)
  }, [])

  const updateSettings = useCallback(
    (patch) => {
      const { keys: nextKeys, ...rest } = patch
      if (nextKeys) setKeysAndSave(nextKeys)
      if (Object.keys(rest).length) {
        setPrefs((previous) => {
          const next = { ...previous, ...rest }
          savePrefs(next)
          return next
        })
      }
    },
    [setKeysAndSave],
  )

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(
    () => () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    },
    [],
  )

  // Finish an OAuth redirect, if one just brought the user back.
  useEffect(() => {
    let cancelled = false
    const finish = async () => {
      if (!new URLSearchParams(window.location.search).has('code')) return
      try {
        const provider = getOAuthProvider()
        if (provider === 'google') await completeGoogleOAuth()
        else await completeNotionOAuth({ proxyUrl: loadCalendars().notion?.proxyUrl })
        if (cancelled) return
        setCalendars(loadCalendars())
        setToast({ tone: 'ok', message: 'Calendar connected. Your morning view will update in a moment.' })
      } catch (error) {
        if (!cancelled) setToast({ tone: 'warn', message: `Couldn't connect that calendar: ${error.message}` })
      } finally {
        clearOAuthProvider()
      }
    }
    finish()
    return () => {
      cancelled = true
    }
  }, [])

  // Pull today's events from every connected source.
  useEffect(() => {
    let cancelled = false
    const connected = Boolean(
      calendars.google?.token ||
        (calendars.notion?.token && calendars.notion?.databaseId) ||
        calendars.ics?.length ||
        (calendars.caldav?.proxyUrl && calendars.caldav?.calendarUrl),
    )
    if (!connected) {
      setEvents(mockCalendarEvents)
      setCalendarMeta({ loading: false, errors: [], connected: false })
      return undefined
    }
    setCalendarMeta({ loading: true, errors: [], connected: true })
    getTodaysEvents(calendars, TODAY)
      .then((result) => {
        if (cancelled) return
        setEvents(result.events)
        setCalendarMeta({ loading: false, errors: result.errors, connected: true })
      })
      .catch((error) => {
        if (cancelled) return
        setEvents([])
        setCalendarMeta({ loading: false, errors: [error.message], connected: true })
      })
    return () => {
      cancelled = true
    }
  }, [calendars, calendarNonce])

  // One-click Morning Run: weather + feeds + LLM synthesis, with offline fallbacks.
  const runMorning = useCallback(
    async ({ forceRefresh = false } = {}) => {
      const runId = runCounterRef.current + 1
      runCounterRef.current = runId
      const before = JSON.stringify(keys)

      setRefreshing(true)
      setWeatherMeta((previous) => ({ ...previous, loading: true, error: null }))
      setWardrobeLoading(true)
      setNewsLoading(true)

      try {
        const result = await runMorningBriefing({ prefs, keys, forceRefresh, schedule: events })
        if (runId !== runCounterRef.current) return
        setWeather(result.weather)
        setWeatherMeta(result.weatherMeta)
        setWardrobe(result.wardrobe)
        setRotationMeta(result.wardrobeMeta.source === 'ai' ? result.wardrobeMeta : null)
        setRawNews(result.rawNews)
        setNewsMeta(result.newsMeta)
        setNewsDigest(result.newsDigest)
        setNewsSource(result.newsSource)
        setNewsRankMeta(result.newsRankMeta)
        if (JSON.stringify(result.keys) !== before) setKeys(result.keys)
      } finally {
        if (runId === runCounterRef.current) {
          setWeatherMeta((previous) => ({ ...previous, loading: false }))
          setWardrobeLoading(false)
          setNewsLoading(false)
          setRefreshing(false)
        }
      }
    },
    [prefs, keys, events],
  )

  useEffect(() => {
    runMorning()
  }, [runMorning])

  const simulateRateLimit = (keyId, daily = false) => {
    const target = keyId ? keys.find((key) => key.id === keyId) : keys.find(isKeyEligible)
    if (!target) {
      setToast({ tone: 'warn', message: 'Add a working key first, then try this again.' })
      return
    }
    setKeysAndSave(applyRateLimit(keys, target.id, { daily }))
    setToast({
      tone: 'warn',
      message: daily
        ? `${target.label} is used up for today. We'll use a backup tomorrow.`
        : `${target.label} needs a short break. Briefr is trying a backup now.`,
    })
  }

  const handlePing = async (key) => {
    const result = await pingKey(key)
    if (result?.key) {
      setKeysAndSave(keys.map((item) => (item.id === key.id ? result.key : item)))
    }
    return result
  }

  const toggleRateLimitSim = () => {
    const turningOn = !prefs.rateLimitSim
    updateSettings({ rateLimitSim: turningOn })
    if (turningOn) simulateRateLimit()
    else {
      setKeysAndSave(
        keys.map((key) =>
          getKeyStatus(key) === 'cooldown' ? { ...key, cooldownUntil: null, lastError: null } : key,
        ),
      )
      setToast({ tone: 'neutral', message: 'Back to normal. Keys taking a break are ready again.' })
    }
  }

  const refreshDigest = () => {
    if (refreshing) return
    if (prefs.rateLimitSim) simulateRateLimit()
    setCalendarNonce((value) => value + 1)
    setToast({ tone: 'ok', message: 'Getting today together…' })
    runMorning({ forceRefresh: true })
  }

  const playBriefing = () => {
    if (!('speechSynthesis' in window)) {
      setToast({ tone: 'warn', message: "This browser can't read the briefing out loud." })
      return
    }
    if (audioState === 'paused') {
      window.speechSynthesis.resume()
      setAudioState('playing')
      return
    }
    window.speechSynthesis.cancel()
    const script = buildBriefingScript({
      dateLabel: digest.dateLabel,
      weather,
      wardrobe,
      newsDigest,
      rawNews,
      inbox: digest.inbox,
      schedule: events,
    })
    const utterance = new SpeechSynthesisUtterance(script)
    utterance.rate = 1.02
    utterance.onend = () => {
      utteranceRef.current = null
      setAudioState('idle')
    }
    utterance.onerror = () => {
      utteranceRef.current = null
      setAudioState('idle')
    }
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
    setAudioState('playing')
  }

  const pauseBriefing = () => {
    window.speechSynthesis.pause()
    setAudioState('paused')
  }

  const resumeBriefing = () => {
    window.speechSynthesis.resume()
    setAudioState('playing')
  }

  const stopBriefing = () => {
    window.speechSynthesis.cancel()
    utteranceRef.current = null
    setAudioState('idle')
  }

  const handleTriage = async (text) => {
    setTriageLoading(true)
    const keysSnapshot = keys
    if (!keysSnapshot.length) {
      setTriageResult(triageLocally(text))
      setTriageSource('rules')
      setTriageLoading(false)
      return
    }
    try {
      const { data } = await runWithRotation({
        keys: keysSnapshot,
        prompt: buildTriagePrompt({ text }),
        systemPrompt: SYSTEM_PROMPT,
        forceRefresh: true,
        cacheKey: null,
      })
      const category = ['Needs Action', 'FYI', 'Newsletters & Promos'].includes(data.category)
        ? data.category
        : 'FYI'
      setTriageResult({
        category,
        summary: String(data.summary ?? ''),
        reason: String(data.reason ?? ''),
        nextStep: String(data.nextStep ?? ''),
      })
      setTriageSource('ai')
    } catch {
      setTriageResult(triageLocally(text))
      setTriageSource('rules')
      setToast({ tone: 'warn', message: "Couldn't use AI for this — sorted it on your device instead." })
    } finally {
      setTriageLoading(false)
      const after = JSON.stringify(loadKeys())
      if (after !== JSON.stringify(keysSnapshot)) setKeys(loadKeys())
    }
  }

  const resetDemo = () => {
    stopBriefing()
    clearAllStorage()
    setPrefs({ ...DEFAULT_PREFS })
    setKeys([])
    setCalendars({ google: { clientId: '', token: null }, notion: { token: null, databaseId: '', clientId: '', redirectUri: '', proxyUrl: '' }, ics: [], caldav: { proxyUrl: '', calendarUrl: '' } })
    setShowCalendars(false)
    setWeather(mockWeather)
    setWardrobe(buildFallbackWardrobe(mockWeather, DEFAULT_PREFS))
    setRotationMeta(null)
    setRawNews([])
    setNewsDigest(null)
    setNewsSource('raw')
    setNewsRankMeta(null)
    setNewsMeta({ errors: [], sourceCount: 0 })
    setTriageResult(null)
    setTriageSource('rules')
    setBannerDismissed(false)
    setShowKeyManager(false)
    setShowWizard(false)
    setToast({ tone: 'ok', message: 'Fresh start. Saved keys and briefings are cleared.' })
  }

  const wipeLocalData = () => {
    if (!window.confirm('Disconnect every calendar and clear saved keys, settings and briefings on this device?')) return
    clearAllStorage()
    setKeys([])
    setCalendars(loadCalendars())
    setPrefs(loadPrefs())
    setRotationMeta(null)
    setNewsDigest(null)
    setNewsSource('raw')
    setTriageResult(null)
    setShowKeyManager(false)
    setCalendarNonce((value) => value + 1)
    setToast({ tone: 'ok', message: 'Everything saved on this device is cleared.' })
  }

  const showSetupBanner = !prefs.onboardingDone && !bannerDismissed

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <TopNav
        dateLabel={digest.dateLabel}
        headline={wardrobe.headline || digest.headline}
        tone={prefs.tone}
        onToneChange={(tone) => updateSettings({ tone })}
        audioState={audioState}
        onPlay={playBriefing}
        onPause={pauseBriefing}
        onResume={resumeBriefing}
        onStop={stopBriefing}
        onRefresh={refreshDigest}
        refreshing={refreshing || weatherMeta.loading}
        rateLimitSim={prefs.rateLimitSim}
        onToggleRateLimit={toggleRateLimitSim}
        onOpenSettings={() => setShowKeyManager(true)}
        account={account}
        onOpenAccount={() => setShowAccount(true)}
      />

      <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 lg:pb-10 lg:px-8">
        <RotationStatusBanner meta={rotationMeta} keys={keys} onManage={() => setShowKeyManager(true)} />

        {showSetupBanner && (
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#4F46E5]">
              <Sparkles size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-[#3730A3]">New here? Set up Briefr in 3 quick steps.</p>
              <p className="text-[11px] text-[#6366F1]">
                Take your time. The weather and outfit advice work with no keys at all.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowWizard(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F46E5] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#4338CA]"
            >
              Start setup <ArrowRight size={12} />
            </button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss setup reminder"
              className="rounded-lg p-1 text-[#818CF8] hover:bg-white/70 hover:text-[#3730A3]"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.035em] text-[#09090B] sm:text-[27px]">
              Good morning. Here's your day.
            </h1>
            <p className="mt-1 text-[12px] text-[#71717A]">
              Weather, news, and what needs you — all in one calm place.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E4E4E7] bg-white px-3 py-1.5 text-[11px] font-medium text-[#71717A]">
            <span className="size-1.5 rounded-full bg-[#10B981]" />
            {weatherMeta.source === 'live' ? 'Live weather' : 'Sample weather'} ·{' '}
            {keys.length ? `${keys.length} AI key${keys.length === 1 ? '' : 's'}` : 'No AI key'} ·{' '}
            {rotationMeta?.cached ? 'Saved today' : 'Fresh'}
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
          <WeatherOutfitCard
            weather={weather}
            wardrobe={wardrobe}
            source={weatherMeta.source}
            wardrobeSource={rotationMeta ? 'ai' : 'deterministic'}
            loading={wardrobeLoading}
            error={weatherMeta.error}
            preferences={{
              sensitivity: prefs.sensitivity,
              commute: prefs.commute,
              tone: prefs.tone,
            }}
          />
          <NewsFeedCard
            digest={newsDigest}
            items={rawNews}
            source={newsSource}
            loading={newsLoading}
            meta={newsRankMeta}
            error={newsMeta.errors.length ? `${newsMeta.errors.length} feed(s) failed` : null}
            sourceCount={newsMeta.sourceCount}
          />
          <div className="space-y-5">
            <ScheduleCard
              events={events}
              loading={calendarMeta.loading}
              errors={calendarMeta.errors}
              dayNotes={wardrobe.dayNotes ?? ''}
              onConnect={() => setShowCalendars(true)}
            />
            <TriageCard
              inbox={digest.inbox}
              result={triageResult}
              loading={triageLoading}
              source={triageSource}
              onTriage={handleTriage}
            />
          </div>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-[#E4E4E7] pt-5 text-[10px] text-[#A1A1AA]">
          <span className="font-semibold tracking-[-0.02em] text-[#71717A]">Briefr</span>
          <span>Free weather · Your keys stay here · Nothing to pay</span>
        </footer>
      </main>

      {showWizard && (
        <OnboardingWizard
          settings={settings}
          onChange={updateSettings}
          onClose={() => setShowWizard(false)}
          onPing={handlePing}
          onSimulateRateLimit={simulateRateLimit}
        />
      )}

      {showKeyManager && (
        <KeyManagerModal
          keys={keys}
          onChange={setKeysAndSave}
          onClose={() => setShowKeyManager(false)}
          onPing={handlePing}
          onSimulateRateLimit={simulateRateLimit}
          meta={rotationMeta}
          cacheKey={digestCacheKey(prefs)}
          onForceRefresh={refreshDigest}
          onResetDemo={resetDemo}
          connections={calendars}
          onWipeLocalData={wipeLocalData}
          account={account}
        />
      )}

      {showCalendars && (
        <CalendarSourcesModal
          connections={calendars}
          onChange={setCalendarsAndSave}
          onClose={() => setShowCalendars(false)}
        />
      )}

      {showAccount && (
        <AccountModal
          account={account}
          onChange={handleAccountChange}
          onClose={() => setShowAccount(false)}
        />
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-[60] flex max-w-sm items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[11px] font-medium shadow-lg ${TOAST_TONES[toast.tone] ?? TOAST_TONES.neutral}`}
        >
          {toast.tone === 'warn' ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> : <Check size={14} className="mt-0.5 shrink-0" />}
          <span className="leading-snug">{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="ml-1 opacity-60 hover:opacity-100">
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  )
}
