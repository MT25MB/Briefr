import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Database,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import Modal from './Modal.jsx'
import { Segmented } from './ui.jsx'
import ProviderGuides from './ProviderGuides.jsx'
import PrivacyPanel from './PrivacyPanel.jsx'
import { PROVIDER_CONFIG, getKeyStatus, markReady } from '../lib/llmRotator.js'
import { safeEndpoint } from '../lib/llmClient.js'
import {
  COVERAGE_MODES,
  COVERAGE_MODE_LABELS,
  POLITICAL_LENSES,
  POLITICAL_LENS_LABELS,
} from '../lib/storage.js'

const STATUS_TONES = {
  ready: 'emerald',
  cooldown: 'amber',
  daily: 'rose',
  invalid: 'rose',
}

function statusLabel(key, now) {
  const status = getKeyStatus(key, now)
  if (status === 'cooldown') {
    return `Taking a break · ${Math.max(1, Math.ceil((key.cooldownUntil - now) / 1000))}s left`
  }
  if (status === 'daily') return 'Used up today'
  if (status === 'invalid') return 'Needs a check'
  return 'Ready to go'
}

export function KeyEditor({ keys, onChange, onPing, onSimulateRateLimit, compact = false }) {
  const [provider, setProvider] = useState('gemini')
  const [apiKey, setApiKey] = useState('')
  const [label, setLabel] = useState('')
  const [baseUrl, setBaseUrl] = useState(PROVIDER_CONFIG.gemini.baseUrl)
  const [showKey, setShowKey] = useState(false)
  const [testingId, setTestingId] = useState(null)
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const chooseProvider = (id) => {
    setProvider(id)
    setBaseUrl(PROVIDER_CONFIG[id]?.baseUrl ?? '')
  }

  const addKey = () => {
    const value = provider === 'ollama' ? apiKey.trim() || 'local' : apiKey.trim()
    if (!value) return
    const config = PROVIDER_CONFIG[provider]
    let endpoint
    try {
      endpoint = safeEndpoint(baseUrl.trim() || config.baseUrl, provider)
    } catch (error) {
      setNotice(error.message)
      return
    }
    const newKey = {
      id: `key_${Date.now()}`,
      provider,
      apiKey: value,
      label: label.trim() || `${config.label} · ····${value.slice(-4)}`,
      baseUrl: endpoint,
      cooldownUntil: null,
      dailyExhausted: false,
      lastError: null,
    }
    onChange([...keys, newKey])
    setApiKey('')
    setLabel('')
    setNotice(`${config.label} added. It will act as a backup when another key hits a limit.`)
  }

  const ping = async (key) => {
    setTestingId(key.id)
    const result = await onPing(key)
    if (result?.key) onChange(keys.map((item) => (item.id === key.id ? result.key : item)))
    setTestingId(null)
    setNotice(result?.message ?? 'Test finished.')
  }

  const moveKey = (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= keys.length) return
    const next = [...keys]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
    setNotice(`${next[target].label} moved to position ${target + 1}.`)
  }

  return (
    <div className={compact ? '' : 'mt-5 border-t border-[var(--line)] pt-5'}>
      {!compact && <p className="text-[0.875rem] font-semibold text-[var(--ink)]">Keys you've added</p>}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {Object.entries(PROVIDER_CONFIG).filter(([id]) => id !== 'ollama').map(([id, config]) => (
          <button
            key={id}
            type="button"
            onClick={() => chooseProvider(id)}
            aria-pressed={provider === id}
            className={`inline-flex min-h-12 items-center border-b-2 px-2 text-[0.875rem] font-semibold transition-colors ${
              provider === id
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {config.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && addKey()}
            placeholder={provider === 'ollama' ? 'Not needed for a local model' : 'Paste the key here'}
            className="field min-h-12 pr-12 font-mono placeholder:font-sans"
          />
          <button
            type="button"
            onClick={() => setShowKey((value) => !value)}
            aria-label={showKey ? 'Hide key' : 'Show key'}
            className="absolute right-0 top-1/2 inline-flex min-h-12 min-w-12 -translate-y-1/2 items-center justify-center text-[var(--faint)] hover:text-[var(--ink)]"
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && addKey()}
          placeholder="Name (optional)"
          className="field min-h-12"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="Service address"
          aria-label="Service address"
          className="field min-h-12 min-w-0 flex-1 font-mono"
        />
        <button
          type="button"
          onClick={addKey}
          disabled={provider !== 'ollama' && !apiKey.trim()}
          className="primary-button disabled:opacity-40"
        >
          <Plus size={13} /> Add key
        </button>
      </div>

      {keys.length > 0 && (
        <ol className="mt-4 border-t border-[var(--line)] pt-2">
          {keys.map((key, index) => {
            const status = getKeyStatus(key, now)
            return (
              <li key={key.id} className="border-b border-[var(--line)] py-4 last:border-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-[0.9375rem] font-semibold text-[var(--ink)]">
                    <span className="metadata tnum mr-2">{index + 1}.</span>
                    {key.label}
                  </span>
                  <span className="metadata">{statusLabel(key, now)}</span>
                </div>
                <p className="metadata mt-1 truncate font-mono">
                  {key.provider} · {key.baseUrl}
                  {key.model ? ` · ${key.model}` : ''}
                </p>
                {key.lastError && <p className="metadata mt-1 text-[var(--danger)]">{key.lastError}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1">
                  <button
                    type="button"
                    onClick={() => ping(key)}
                    className="inline-flex min-h-12 items-center gap-1.5 px-2 text-[0.8125rem] font-semibold text-[var(--accent)] hover:underline"
                  >
                    {testingId === key.id ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
                    Try this key
                  </button>
                  <button
                    type="button"
                    onClick={() => moveKey(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${key.label} up`}
                    className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--paper)] disabled:opacity-30"
                  >
                    <ArrowUp size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveKey(index, 1)}
                    disabled={index === keys.length - 1}
                    aria-label={`Move ${key.label} down`}
                    className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--paper)] disabled:opacity-30"
                  >
                    <ArrowDown size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSimulateRateLimit(key.id, false)}
                    aria-label={`Simulate a rate limit on ${key.label}`}
                    className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--warning)]"
                  >
                    <AlertTriangle size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSimulateRateLimit(key.id, true)}
                    aria-label={`Simulate a daily cap on ${key.label}`}
                    className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--danger)]"
                  >
                    <Database size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(markReady(keys, key.id))}
                    aria-label={`Reset status of ${key.label}`}
                    className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--success)]"
                  >
                    <RotateCcw size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(keys.filter((item) => item.id !== key.id))}
                    aria-label={`Remove ${key.label}`}
                    className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--danger)]"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {!compact && (
        <p className="metadata mt-4">Keys rotate automatically after a rate limit. Free tiers have limits, so keep sensitive text out of prompts.</p>
      )}
      {notice && <p className="mt-2 text-[0.8125rem] font-medium text-[var(--success)]">{notice}</p>}
    </div>
  )
}

export default function KeyManagerModal({
  keys,
  onChange,
  onClose,
  onPing,
  onSimulateRateLimit,
  onToggleRateLimit,
  meta,
  cacheKey,
  onForceRefresh,
  onResetDemo,
  connections,
  onWipeLocalData,
  account,
  prefs,
  onOpenAccount,
  onSignOut,
  onPrefsChange,
  theme = 'system',
  onThemeChange,
  onDisconnectGoogle,
  onDisconnectNotion,
  onDisconnectIcs,
  onDisconnectCaldav,
  onClearCache,
  onExportData,
  onDeleteData,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [localBaseUrl, setLocalBaseUrl] = useState('http://localhost:11434')
  const [localModel, setLocalModel] = useState('llama3.1')

  const addLocalModel = () => {
    const model = localModel.trim()
    if (!model) return
    onChange([
      ...keys,
      {
        id: `key_${Date.now()}`,
        provider: 'ollama',
        apiKey: 'local',
        label: `Local · ${model}`,
        baseUrl: localBaseUrl.trim() || 'http://localhost:11434',
        model,
        cooldownUntil: null,
        dailyExhausted: false,
        lastError: null,
      },
    ])
    setLocalModel('')
  }

  const setLens = (lens) =>
    onPrefsChange({
      politicalLens: lens,
      ...(lens === 'neutral' ? {} : { savedPoliticalLens: lens }),
    })

  const footer = (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <span className="metadata">{keys.length} key{keys.length === 1 ? '' : 's'} saved on this device</span>
        <button type="button" onClick={onResetDemo} className="danger-button">Reset Briefr</button>
      </div>
      <button type="button" onClick={onClose} className="primary-button">Close settings</button>
    </>
  )

  return (
    <Modal
      label="API keys and settings"
      title="Keys & settings"
      description="Add as many keys as you like. If one hits its limit, Briefr uses the next."
      onClose={onClose}
      footer={footer}
    >
      <div>
        <div className="border-t border-[var(--line)] pt-5">
            <h3 className="reading-title">Political lens</h3>
            <p className="metadata mt-1">
              Optional. Chooses how news is ranked and framed. Weather, calendar, and factual claims are never changed.
            </p>
            <label htmlFor="settings-political-lens" className="sr-only">Political news lens</label>
            <select
              id="settings-political-lens"
              aria-label="Political news lens"
              value={prefs?.politicalLens ?? 'neutral'}
              onChange={(event) => setLens(event.target.value)}
              className="field mt-3 min-h-12"
            >
              {POLITICAL_LENSES.map((lens) => (
                <option key={lens} value={lens}>{POLITICAL_LENS_LABELS[lens]}</option>
              ))}
            </select>
            {prefs?.politicalLens !== 'neutral' && prefs?.politicalLens !== 'unfiltered' && (
              <div className="mt-3">
                <p className="metadata">Coverage</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {COVERAGE_MODES.map((mode) => {
                    const active = (prefs?.coverageMode ?? 'balanced') === mode
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => onPrefsChange({ coverageMode: mode })}
                        aria-pressed={active}
                        className={`inline-flex min-h-12 items-center border-b-2 px-2 text-[0.875rem] font-semibold ${
                          active ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {COVERAGE_MODE_LABELS[mode]}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <p className="metadata mt-3">Switch between this lens and Neutral from the news card.</p>

            <div className="mt-5">
              <p className="reading-title">Appearance</p>
              <p className="metadata mt-1">System follows your device setting.</p>
              <Segmented
                options={['System', 'Light', 'Dark']}
                value={theme.charAt(0).toUpperCase() + theme.slice(1)}
                onChange={(value) => onThemeChange?.(value.toLowerCase())}
                className="mt-2"
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onPrefsChange({ soundAlerts: prefs?.soundAlerts === false })}
                aria-pressed={prefs?.soundAlerts !== false}
                className="quiet-button"
              >
                Alert sound: {prefs?.soundAlerts === false ? 'Off' : 'On'}
              </button>
              <button
                type="button"
                onClick={onToggleRateLimit}
                aria-pressed={Boolean(prefs?.rateLimitSim)}
                className="quiet-button"
              >
                {prefs?.rateLimitSim ? 'Stop rate-limit test' : 'Simulate a rate limit'}
              </button>
            </div>
          </div>

          <div className="mt-5">
            <PrivacyPanel
              connections={connections}
              keyCount={keys.length}
              prefs={prefs}
              account={account}
              onOpenAccount={onOpenAccount}
              onSignOut={onSignOut}
              onDisconnectGoogle={onDisconnectGoogle}
              onDisconnectNotion={onDisconnectNotion}
              onDisconnectIcs={onDisconnectIcs}
              onDisconnectCaldav={onDisconnectCaldav}
              onClearCache={onClearCache}
              onExportData={onExportData}
              onDeleteData={onDeleteData}
              onWipeLocalData={onWipeLocalData}
            />
          </div>

          <p className="mb-2 mt-5 text-[0.875rem] font-semibold text-[var(--ink)]">No key yet? Here's how to get one</p>
          <ProviderGuides />

          <div className="mt-6 border-t border-[var(--line)] pt-5">
            <p className="text-[0.875rem] font-semibold text-[var(--ink)]">Today's briefing</p>
            {meta ? (
              <p className="metadata mt-2">
                {meta.provider} · {meta.model} via {meta.keyLabel}
                {meta.rotatedCount > 0 && ` · ${meta.rotatedCount} rotations`}
                {meta.cached && ' · saved earlier'}
                {meta.rotationNote && ` · ${meta.rotationNote}`}
              </p>
            ) : (
              <p className="metadata mt-2">Using built-in outfit advice.</p>
            )}
            <p className="metadata mt-2 truncate font-mono">Saved as: {cacheKey}</p>
            <button type="button" onClick={onForceRefresh} className="quiet-button mt-4">
              Refresh briefing
            </button>
          </div>

          <KeyEditor
            keys={keys}
            onChange={onChange}
            onPing={onPing}
            onSimulateRateLimit={onSimulateRateLimit}
          />

          <div className="mt-5 border-t border-[var(--line)] pt-5">
            <button
              type="button"
              onClick={() => setShowAdvanced((value) => !value)}
              aria-expanded={showAdvanced}
              className="flex min-h-12 w-full items-center gap-2 px-4 py-3 text-left text-[0.875rem] font-semibold text-[var(--ink-2)] hover:bg-[var(--paper)]"
            >
              <ChevronDown size={14} className={`shrink-0 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              Advanced: run a model on your computer
            </button>
            {showAdvanced && (
              <div className="space-y-3 border-t border-[var(--line-soft)] px-4 py-4">
                <p className="text-[0.8125rem] leading-relaxed text-[var(--muted)]">
                  Already using Ollama on your computer? Add it here. No account or key needed.
                  Everything stays on your machine.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-[0.75rem] font-semibold text-[var(--muted)]">
                    Address
                    <input
                      value={localBaseUrl}
                      onChange={(event) => setLocalBaseUrl(event.target.value)}
                      placeholder="http://localhost:11434"
                      className="field mt-1 min-h-12 font-mono"
                    />
                  </label>
                  <label className="text-[0.75rem] font-semibold text-[var(--muted)]">
                    Model name
                    <input
                      value={localModel}
                      onChange={(event) => setLocalModel(event.target.value)}
                      placeholder="llama3.1"
                      className="field mt-1 min-h-12 font-mono"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={addLocalModel}
                  disabled={!localModel.trim()}
                  className="quiet-button disabled:opacity-40"
                >
                  <Plus size={12} /> Add this local model
                </button>
                <p className="flex items-start gap-1.5 rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-[0.75rem] leading-relaxed text-[var(--warning)]">
                  <Info size={12} className="mt-0.5 shrink-0" />
                  Your browser can only reach Ollama if Ollama allows this site. Start Ollama with{' '}
                  <code className="font-mono">OLLAMA_ORIGINS</code> set to your site address (for local
                  testing: <code className="font-mono">OLLAMA_ORIGINS=* ollama serve</code>). Otherwise
                  the key check won't connect.
                </p>
              </div>
            )}
          </div>
        </div>
    </Modal>
  )
}
