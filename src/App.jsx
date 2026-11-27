import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, X } from 'lucide-react'
import TopNav from './components/TopNav.jsx'
import WeatherOutfitCard from './components/WeatherOutfitCard.jsx'
import NewsFeedCard from './components/NewsFeedCard.jsx'
import ScheduleCard from './components/ScheduleCard.jsx'
import TriageCard from './components/TriageCard.jsx'
import OnboardingWizard from './components/OnboardingWizard.jsx'
import KeyManagerModal from './components/KeyManagerModal.jsx'
import CalendarSourcesModal from './components/CalendarSourcesModal.jsx'
import AccountModal from './components/AccountModal.jsx'
import { CardBoundary } from './components/ErrorBoundary.jsx'
import RotationStatusBanner from './components/RotationStatusBanner.jsx'
import MorningChecklist from './components/MorningChecklist.jsx'
import { prepareSchedule } from './lib/schedule.js'
import { digest, mockWeather } from './lib/mockDigest.js'
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
  saveQuickEvent,
  todayKey,
} from './lib/storage.js'
import { applyRateLimit, getKeyStatus, isKeyEligible, pingKey, runWithRotation } from './lib/llmRotator.js'
import { buildFallbackWardrobe } from './lib/prompts.js'
import {
  clearTriage,
  emptyTriage,
  loadTriage,
  triageMessages,
} from './lib/triageService.js'
import { buildBriefingScript } from './lib/audioBriefing.js'
import { playAlertTone } from './lib/alertSound.js'
import { applyTheme, readTheme, storeTheme } from './lib/theme.js'
import { runMorningDigest } from './lib/digestRunner.js'
import {
  bootstrapAuth,
  clearCloudTriage,
  deleteAccount,
  getCurrentAccount,
  loadCloudTriage,
  onAuthChange,
  saveCloudTriage,
  saveCloudData,
  saveProfile,
  signOut,
} from './lib/accountService.js'
import { clearCachedDigest, exportAccountData, loadCloudData } from './lib/db.js'
import {
  clearOAuthProvider,
  completeGoogleOAuth,
  completeNotionOAuth,
  getOAuthProvider,
} from './lib/calendarService.js'

const TOAST_TONES = {
  ok: 'text-[var(--success)]',
  warn: 'text-[var(--warning)]',
  neutral: 'text-[var(--ink-2)]',
}

export default function App() {
  const [prefs, setPrefs] = useState(loadPrefs)
  const [keys, setKeys] = useState(loadKeys)
  const [showWizard, setShowWizard] = useState(false)
  const [showKeyManager, setShowKeyManager] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState(null)
  const [calendarNonce, setCalendarNonce] = useState(0)
  const [today, setToday] = useState(todayKey)
  const [now, setNow] = useState(() => new Date())
  const [triage, setTriage] = useState(() => loadTriage(todayKey()))
  const [theme, setTheme] = useState(readTheme)
  const [resolvedTheme, setResolvedTheme] = useState(() => applyTheme(readTheme()))
  const runCounterRef = useRef(0)
  const runMorningRef = useRef(null)
  const triageSeqRef = useRef(0)

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

  const [triageLoading, setTriageLoading] = useState(false)

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

  const handleAccountChange = useCallback(async (next) => {
    setAccount(next)
    let nextPrefs = loadPrefs()
    let nextCalendars = loadCalendars()
    let nextTriage = loadTriage(todayKey())
    if (next?.cloud) {
      try {
        const [cloud, cloudTriage] = await Promise.all([
          loadCloudData(next.id),
          loadCloudTriage(next.id, todayKey()),
        ])
        if (cloud?.prefs) nextPrefs = { ...nextPrefs, ...cloud.prefs }
        if (cloud?.calendars) {
          // Sync only non-secret config; never let a partial cloud row erase
          // locally stored OAuth tokens, database ids, or added ICS feeds.
          const merged = {
            google: { ...(nextCalendars.google ?? {}), ...(cloud.calendars.google ?? {}) },
            notion: { ...(nextCalendars.notion ?? {}), ...(cloud.calendars.notion ?? {}) },
            caldav: { ...(nextCalendars.caldav ?? {}), ...(cloud.calendars.caldav ?? {}) },
            ics: [...(nextCalendars.ics ?? []), ...(cloud.calendars.ics ?? [])],
          }
          const seen = new Set()
          merged.ics = merged.ics.filter((feed) => {
            const id = feed?.id ?? feed?.url
            if (!id || seen.has(id)) return false
            seen.add(id)
            return true
          })
          nextCalendars = merged
        }
        if (cloudTriage) nextTriage = cloudTriage
        await saveProfile(next.id, { displayName: next.name, email: next.email })
      } catch (error) {
        setToast({ tone: 'warn', message: `Couldn't load synced settings: ${error.message}` })
      }
    }
    savePrefs(nextPrefs)
    saveCalendars(nextCalendars)
    setPrefs(nextPrefs)
    setCalendars(nextCalendars)
    setKeys(loadKeys())
    setRotationMeta(null)
    setNewsDigest(null)
    setNewsSource('raw')
    setTriage(nextTriage)
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

  const toggleLens = useCallback(() => {
    if (prefs.politicalLens === 'neutral') {
      const saved = prefs.savedPoliticalLens
      if (!saved || saved === 'neutral') {
        setShowKeyManager(true)
        return
      }
      updateSettings({ politicalLens: saved })
      return
    }
    updateSettings({ politicalLens: 'neutral', savedPoliticalLens: prefs.politicalLens })
  }, [prefs.politicalLens, prefs.savedPoliticalLens, updateSettings])

  useEffect(() => {
    if (!toast) return undefined
    if (toast.tone === 'warn' && prefs.soundAlerts !== false) playAlertTone()
    const timeout = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timeout)
  }, [toast, prefs.soundAlerts])

  useEffect(
    () => () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    },
    [],
  )

  // Theme follows the OS only while the preference is "system".
  useEffect(() => {
    storeTheme(theme)
    setResolvedTheme(applyTheme(theme))
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (theme === 'system') setResolvedTheme(applyTheme('system'))
    }
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [theme])

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.content = resolvedTheme === 'dark' ? '#14130f' : '#f7f6f2'
  }, [resolvedTheme])

  // Keep countdowns and "Happening now" live, and roll daily state at midnight.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
      const key = todayKey()
      if (key === today) return
      setToday(key)
      setTriage(emptyTriage(key))
      setCalendarNonce((value) => value + 1)
      setToast({ tone: 'neutral', message: 'A new day — today’s schedule and triage are fresh.' })
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [today])

  // Restore the Supabase session (or stay in local-only mode) on reload.
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const restored = await bootstrapAuth()
      if (!cancelled) await handleAccountChange(restored)
    }
    init()
    let unsubscribe = () => {}
    onAuthChange((next) => {
      if (!cancelled) handleAccountChange(next)
    }).then((stop) => {
      if (cancelled) stop()
      else unsubscribe = stop
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [handleAccountChange])

  // Non-secret preferences and calendar identifiers follow the account.
  useEffect(() => {
    if (!account?.cloud) return undefined
    const timer = window.setTimeout(() => {
      saveCloudData(account.id, { prefs, calendars }).catch((error) => {
        setToast({ tone: 'warn', message: `Couldn't sync settings: ${error.message}` })
      })
    }, 600)
    return () => window.clearTimeout(timer)
  }, [account, prefs, calendars])

  // Structured triage items follow the account; pasted text never does.
  useEffect(() => {
    if (!account?.cloud) return undefined
    const timer = window.setTimeout(() => {
      saveCloudTriage(account.id, triage).catch((error) => {
        setToast({ tone: 'warn', message: `Couldn't sync triage: ${error.message}` })
      })
    }, 600)
    return () => window.clearTimeout(timer)
  }, [account, triage])

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
      setCalendarMeta((previous) => ({ ...previous, loading: true }))

      try {
        const result = await runMorningDigest({
          prefs,
          keys,
          forceRefresh,
          connections: calendars,
          date: today,
        })
        if (runId !== runCounterRef.current) return
        setEvents(result.schedule)
        setCalendarMeta(result.calendarMeta)
        setWeather(result.weather)
        setWeatherMeta(result.weatherMeta)
        setWardrobe(result.wardrobe)
        setRotationMeta(['ai', 'fallback'].includes(result.wardrobeMeta.source) ? result.wardrobeMeta : null)
        setRawNews(result.rawNews)
        setNewsMeta(result.newsMeta)
        setNewsDigest(result.newsDigest)
        setNewsSource(result.newsSource)
        setNewsRankMeta(result.newsRankMeta)
        if (JSON.stringify(result.keys) !== before) setKeys(result.keys)
      } catch (error) {
        if (runId === runCounterRef.current) {
          setCalendarMeta((previous) => ({ ...previous, loading: false, errors: [error.message] }))
          setWeatherMeta((previous) => ({ ...previous, error: error.message }))
          setNewsMeta((previous) => ({ ...previous, errors: [...previous.errors, error.message] }))
        }
      } finally {
        if (runId === runCounterRef.current) {
          setWeatherMeta((previous) => ({ ...previous, loading: false }))
          setWardrobeLoading(false)
          setNewsLoading(false)
          setCalendarMeta((previous) => ({ ...previous, loading: false }))
          setRefreshing(false)
        }
      }
    },
    [prefs, keys, calendars, today],
  )
  runMorningRef.current = runMorning

  // Auto-run only on genuine briefing inputs. Rotation updates key status, and
  // that must not launch a second full digest (or a force-refresh race).
  const autoRunKey = JSON.stringify([
    today,
    calendarNonce,
    prefs.location,
    prefs.tone,
    prefs.sensitivity,
    prefs.commute,
    prefs.topics,
    prefs.feeds,
    prefs.politicalLens,
    prefs.coverageMode,
  ])
  useEffect(() => {
    runMorningRef.current?.()
  }, [autoRunKey])

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

  const addQuickEvent = ({ title, time = '', location = '' }) => {
    const start = new Date()
    if (time) {
      const [hours, minutes] = time.split(':').map(Number)
      start.setHours(hours, minutes, 0, 0)
    } else {
      start.setHours(9, 0, 0, 0)
    }
    saveQuickEvent(
      {
        id: `quick_${Date.now()}`,
        title,
        startTime: start.toISOString(),
        endTime: new Date(start.getTime() + 1_800_000).toISOString(),
        isAllDay: false,
        location,
        source: 'Quick add',
        status: '',
        notes: '',
      },
      today,
    )
    setCalendarNonce((value) => value + 1)
    setToast({ tone: 'ok', message: `Added ${title} to today.` })
  }

  const refreshDigest = () => {
    if (refreshing) return
    if (prefs.rateLimitSim) simulateRateLimit()
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
      inbox: triage,
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
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.pause()
    setAudioState('paused')
  }

  const resumeBriefing = () => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.resume()
    setAudioState('playing')
  }

  const stopBriefing = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    utteranceRef.current = null
    setAudioState('idle')
  }

  const handleTriage = async (text) => {
    const seq = triageSeqRef.current + 1
    triageSeqRef.current = seq
    setTriageLoading(true)
    const keysSnapshot = keys
    try {
      const next = await triageMessages({
        rawText: text,
        keys: keysSnapshot,
        todayEvents: events,
        tone: prefs.tone,
        date: today,
      })
      if (seq !== triageSeqRef.current) return // a newer paste already landed
      setTriage(next)
      if (keysSnapshot.length && next.source === 'rules') {
        setToast({ tone: 'warn', message: "Couldn't use AI for this — sorted it on your device instead." })
      }
    } finally {
      if (seq === triageSeqRef.current) setTriageLoading(false)
      const after = JSON.stringify(loadKeys())
      if (after !== JSON.stringify(keysSnapshot)) setKeys(loadKeys())
    }
  }

  const completeTriageItem = (id) =>
    setTriage((previous) => {
      const next = {
        ...previous,
        needsAction: previous.needsAction.map((item) => (item.id === id ? { ...item, done: true } : item)),
      }
      saveTriage(next)
      return next
    })

  const clearTriageNow = () => {
    setTriage(clearTriage(today))
    if (account?.cloud) {
      clearCloudTriage(account.id, today).catch((error) => {
        setToast({ tone: 'warn', message: `Couldn't clear synced triage: ${error.message}` })
      })
    }
    setToast({ tone: 'neutral', message: 'Today’s triage is cleared.' })
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      await handleAccountChange(null)
      setToast({ tone: 'neutral', message: 'Signed out. Your keys stay on this device.' })
    } catch (error) {
      setToast({ tone: 'warn', message: error.message })
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
    setTriage(emptyTriage(today))
    setBannerDismissed(false)
    setShowKeyManager(false)
    setShowWizard(false)
    setToast({ tone: 'ok', message: 'Fresh start. Saved keys and briefings are cleared.' })
  }

  const wipeLocalData = (skipConfirm = false) => {
    if (!skipConfirm && !window.confirm('Disconnect every calendar and clear saved keys, settings and briefings on this device?')) return
    clearAllStorage()
    setKeys([])
    setCalendars(loadCalendars())
    setPrefs(loadPrefs())
    setRotationMeta(null)
    setNewsDigest(null)
    setNewsSource('raw')
    setTriage(emptyTriage(today))
    setShowKeyManager(false)
    setCalendarNonce((value) => value + 1)
    setToast({ tone: 'ok', message: 'Everything saved on this device is cleared.' })
  }

  const disconnectGoogle = () =>
    setCalendarsAndSave({ ...calendars, google: { ...(calendars.google ?? {}), token: null } })
  const disconnectNotion = () =>
    setCalendarsAndSave({
      ...calendars,
      notion: { ...(calendars.notion ?? {}), token: null, databaseId: '' },
    })
  const disconnectIcs = (id) =>
    setCalendarsAndSave({ ...calendars, ics: (calendars.ics ?? []).filter((feed) => feed.id !== id) })
  const disconnectCaldav = () =>
    setCalendarsAndSave({
      ...calendars,
      caldav: { ...(calendars.caldav ?? {}), proxyUrl: '', calendarUrl: '' },
    })

  const clearDigestCacheNow = () => {
    clearCachedDigest()
    setRotationMeta(null)
    setNewsDigest(null)
    setNewsSource('raw')
    setToast({ tone: 'ok', message: "Today's saved briefing is cleared." })
  }

  const downloadExport = () => {
    try {
      const data = exportAccountData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `briefr-data-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      setToast({ tone: 'ok', message: 'Your data file is downloading. Secrets are hidden.' })
    } catch (error) {
      setToast({ tone: 'warn', message: error.message })
    }
  }

  const deleteMyData = async () => {
    if (!window.confirm('Delete your account and all Briefr data on this device?')) return
    try {
      await deleteAccount()
      await handleAccountChange(null)
      wipeLocalData(true)
    } catch (error) {
      setToast({ tone: 'warn', message: error.message })
    }
  }

  const showSetupBanner = !prefs.onboardingDone && !bannerDismissed
  const dayPlan = prepareSchedule(events, now)
  const openActions = triage.needsAction.filter((item) => !item.done).length
  const timingFlags =
    Object.keys(dayPlan.friction).length +
    triage.needsAction.filter((item) => !item.done && item.scheduleNote).length
  const scrollToCard = (id) => document.getElementById(id)?.scrollIntoView({ block: 'start' })

  return (
    <div className="min-h-screen bg-[var(--paper)]">
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
        onOpenSettings={() => setShowKeyManager(true)}
        account={account}
        onOpenAccount={() => setShowAccount(true)}
      />

      <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 lg:pb-10 lg:px-8">
        <RotationStatusBanner meta={rotationMeta} keys={keys} onManage={() => setShowKeyManager(true)} />

        {showSetupBanner && (
          <div className="mb-6 flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-center sm:gap-x-6">
            <div className="min-w-0 flex-1">
              <p className="reading-title">Make this morning yours in three small steps.</p>
              <p className="metadata mt-1">Weather and outfit advice already work — keys are optional.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowWizard(true)}
              className="primary-button w-full sm:w-auto"
            >
              Start setup <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss setup reminder"
              className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg text-[var(--faint)] hover:bg-[var(--paper)] hover:text-[var(--ink)]"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="mb-6">
          <h1 className="editorial-title">Good morning.</h1>
          <p className="body-copy mt-2 max-w-prose">
            The weather, the news, and what needs you — in one quiet read.
          </p>
        </div>

        <MorningChecklist
          eventCount={events.length}
          openActions={openActions}
          upNext={dayPlan.upNext}
          timingFlags={timingFlags}
          onOpenDay={() => scrollToCard('your-day')}
          onOpenInbox={() => scrollToCard('inbox')}
        />

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
          <CardBoundary title="Weather" resetKey={calendarNonce}>
            <WeatherOutfitCard
              weather={weather}
              wardrobe={wardrobe}
              error={weatherMeta.error}
              onRetry={() => runMorning({ forceRefresh: true })}
              preferences={{
                sensitivity: prefs.sensitivity,
                commute: prefs.commute,
                tone: prefs.tone,
              }}
            />
          </CardBoundary>
          <CardBoundary title="News" resetKey={calendarNonce}>
            <NewsFeedCard
              digest={newsDigest}
              items={rawNews}
              source={newsSource}
              loading={newsLoading}
              meta={newsRankMeta}
              error={newsMeta.errors.length ? `${newsMeta.errors.length} feed(s) failed` : null}
              sourceCount={newsMeta.sourceCount}
              politicalLens={prefs.politicalLens}
              coverageMode={prefs.coverageMode}
              onToggleLens={toggleLens}
              onRetry={() => runMorning({ forceRefresh: true })}
              onOpenSettings={() => setShowKeyManager(true)}
            />
          </CardBoundary>
          <div className="space-y-5">
            <CardBoundary title="Calendar" resetKey={calendarNonce}>
              <ScheduleCard
                id="your-day"
                events={events}
                now={now}
                loading={calendarMeta.loading}
                errors={calendarMeta.errors}
                dayNotes={wardrobe.dayNotes ?? ''}
                connected={calendarMeta.connected}
                onConnect={() => setShowCalendars(true)}
                onAddQuickEvent={addQuickEvent}
                onRetry={() => runMorning({ forceRefresh: true })}
              />
            </CardBoundary>
            <CardBoundary title="Inbox" resetKey={calendarNonce}>
              <TriageCard
                id="inbox"
                triage={triage}
                loading={triageLoading}
                onTriage={handleTriage}
                onComplete={completeTriageItem}
                onClear={clearTriageNow}
              />
            </CardBoundary>
          </div>
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 pt-5">
          <span className="font-display text-[1.0625rem] font-semibold tracking-[-0.02em] text-[var(--muted)]">Briefr</span>
          <p className="metadata">Free weather · Keys stay on this device</p>
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
          onToggleRateLimit={toggleRateLimitSim}
          meta={rotationMeta}
          cacheKey={digestCacheKey(prefs)}
          onForceRefresh={refreshDigest}
          onResetDemo={resetDemo}
          connections={calendars}
          onWipeLocalData={wipeLocalData}
          account={account}
          prefs={prefs}
          onOpenAccount={() => {
            setShowKeyManager(false)
            setShowAccount(true)
          }}
          onSignOut={handleSignOut}
          onPrefsChange={updateSettings}
          theme={theme}
          onThemeChange={setTheme}
          onDisconnectGoogle={disconnectGoogle}
          onDisconnectNotion={disconnectNotion}
          onDisconnectIcs={disconnectIcs}
          onDisconnectCaldav={disconnectCaldav}
          onClearCache={clearDigestCacheNow}
          onExportData={downloadExport}
          onDeleteData={deleteMyData}
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
          onDeleted={() => wipeLocalData(true)}
        />
      )}

      <div aria-live="polite" className="pointer-events-none fixed bottom-20 right-5 z-[60] max-w-sm lg:bottom-5">
        {toast && (
          <div
            className={`pointer-events-auto flex items-start gap-3 rounded-lg bg-[var(--surface)] px-4 py-3 text-[0.875rem] leading-snug ${TOAST_TONES[toast.tone] ?? TOAST_TONES.neutral}`}
          >
            {toast.tone === 'warn' ? (
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            ) : (
              <Check size={16} className="mt-0.5 shrink-0" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss message"
              className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-md opacity-70 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
