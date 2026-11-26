import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Database,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Lock,
  Play,
  Plus,
  RotateCcw,
  Server,
  Trash2,
  X,
} from 'lucide-react'
import { Badge } from './ui.jsx'
import ProviderGuides from './ProviderGuides.jsx'
import { PROVIDER_CONFIG, getKeyStatus, markReady } from '../lib/llmRotator.js'

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
    const newKey = {
      id: `key_${Date.now()}`,
      provider,
      apiKey: value,
      label: label.trim() || `${config.label} · ····${value.slice(-4)}`,
      baseUrl: baseUrl.trim() || config.baseUrl,
      cooldownUntil: null,
      dailyExhausted: false,
      lastError: null,
    }
    onChange([...keys, newKey])
    setApiKey('')
    setLabel('')
    setNotice(`${config.label} key added. It stays in this browser.`)
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
    <div className={compact ? '' : 'mt-4 rounded-xl border border-[#E4E4E7] bg-white p-4'}>
      {!compact && <p className="text-[12px] font-semibold text-[#09090B]">Keys you've added</p>}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {Object.entries(PROVIDER_CONFIG).filter(([id]) => id !== 'ollama').map(([id, config]) => (
          <button
            key={id}
            type="button"
            onClick={() => chooseProvider(id)}
            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
              provider === id
                ? 'border-[#4F46E5] bg-[#EEF2FF] text-[#4F46E5]'
                : 'border-[#E4E4E7] text-[#71717A] hover:text-[#09090B]'
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
            className="w-full rounded-lg border border-[#E4E4E7] py-2 pl-3 pr-9 font-mono text-[12px] placeholder:font-sans placeholder:text-[#A1A1AA] focus:border-[#A5B4FC] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/10"
          />
          <button
            type="button"
            onClick={() => setShowKey((value) => !value)}
            aria-label={showKey ? 'Hide key' : 'Show key'}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#52525B]"
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && addKey()}
          placeholder="Name (optional)"
          className="w-full rounded-lg border border-[#E4E4E7] px-3 py-2 text-[12px] placeholder:text-[#A1A1AA] focus:border-[#A5B4FC] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/10"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="Service address"
          aria-label="Service address"
          className="min-w-0 flex-1 rounded-lg border border-[#E4E4E7] px-3 py-2 font-mono text-[11px] text-[#52525B] focus:border-[#A5B4FC] focus:outline-none"
        />
        <button
          type="button"
          onClick={addKey}
          disabled={provider !== 'ollama' && !apiKey.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F46E5] px-3 py-2 text-[11px] font-semibold text-white hover:bg-[#4338CA] disabled:opacity-40"
        >
          <Plus size={13} /> Add this key
        </button>
      </div>

      {keys.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-[#F4F4F5] pt-3">
          {keys.map((key, index) => {
            const status = getKeyStatus(key, now)
            return (
              <div key={key.id} className="rounded-lg border border-[#F4F4F5] bg-[#FAFAFA] px-2.5 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tnum flex size-5 shrink-0 items-center justify-center rounded bg-white text-[10px] font-bold text-[#A1A1AA] ring-1 ring-[#E4E4E7]">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[#3F3F46]">{key.label}</span>
                  <Badge tone={STATUS_TONES[status]}>{statusLabel(key, now)}</Badge>
                  <button
                    type="button"
                    onClick={() => ping(key)}
                    aria-label={`Try this key: ${key.label}`}
                    className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[#E4E4E7] bg-white px-2 text-[10px] font-semibold text-[#4F46E5] hover:bg-[#EEF2FF]"
                  >
                    {testingId === key.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    Try this key
                  </button>
                  <button
                    type="button"
                    onClick={() => moveKey(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${key.label} up`}
                    title="Move up in the backup pool"
                    className="rounded-md p-1 text-[#71717A] hover:bg-white hover:text-[#4F46E5] disabled:opacity-30"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveKey(index, 1)}
                    disabled={index === keys.length - 1}
                    aria-label={`Move ${key.label} down`}
                    title="Move down in the backup pool"
                    className="rounded-md p-1 text-[#71717A] hover:bg-white hover:text-[#4F46E5] disabled:opacity-30"
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSimulateRateLimit(key.id, false)}
                    title="Simulate a temporary 429"
                    aria-label={`Simulate rate limit on ${key.label}`}
                    className="rounded-md p-1 text-[#71717A] hover:bg-white hover:text-[#B45309]"
                  >
                    <AlertTriangle size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSimulateRateLimit(key.id, true)}
                    title="Simulate a daily quota 429"
                    aria-label={`Simulate daily cap on ${key.label}`}
                    className="rounded-md p-1 text-[#71717A] hover:bg-white hover:text-[#BE123C]"
                  >
                    <Database size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(markReady(keys, key.id))}
                    title="Reset status"
                    aria-label={`Reset status of ${key.label}`}
                    className="rounded-md p-1 text-[#71717A] hover:bg-white hover:text-[#047857]"
                  >
                    <RotateCcw size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(keys.filter((item) => item.id !== key.id))}
                    title="Remove key"
                    aria-label={`Remove ${key.label}`}
                    className="rounded-md p-1 text-[#71717A] hover:bg-white hover:text-[#BE123C]"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <p className="mt-1 truncate font-mono text-[10px] text-[#A1A1AA]">
                  {key.provider} · {key.baseUrl}
                  {key.model ? ` · ${key.model}` : ''}
                </p>
                {key.lastError && <p className="mt-1 text-[10px] text-[#BE123C]">{key.lastError}</p>}
              </div>
            )
          })}
        </div>
      )}

      {!compact && (
        <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-snug text-[#A1A1AA]">
          <Lock size={11} className="mt-0.5 shrink-0" />
          Keys stay in localStorage on this device and are never sent to a Briefr server. Free tiers can
          have usage limits and privacy trade-offs — avoid sensitive information in prompts. Briefr
          quietly moves to the next key after a rate limit.
        </p>
      )}
      {notice && <p className="mt-2 text-[11px] font-medium text-[#047857]">{notice}</p>}
    </div>
  )
}

export default function KeyManagerModal({
  keys,
  onChange,
  onClose,
  onPing,
  onSimulateRateLimit,
  meta,
  cacheKey,
  onForceRefresh,
  onResetDemo,
}) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

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
        aria-label="API keys and settings"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#F4F4F5] px-5 py-4 sm:px-7">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight text-[#09090B]">Your AI keys</h2>
            <p className="text-[11px] text-[#71717A]">
              Add as many free keys as you like. If one hits its limit, Briefr quietly uses the next.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close key manager"
            className="rounded-lg p-1.5 text-[#A1A1AA] hover:bg-[#F4F4F5] hover:text-[#52525B]"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          <p className="mb-2 text-[12px] font-semibold text-[#09090B]">No key yet? Here's how to get one</p>
          <ProviderGuides />

          <div className="mt-5 rounded-xl border border-[#E4E4E7] bg-[#FCFCFD] p-4">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#09090B]">
              <Server size={13} className="text-[#4F46E5]" /> Today's briefing
            </p>
            {meta ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#52525B]">
                <Badge tone="indigo">{meta.provider}</Badge>
                <span className="font-mono">{meta.model}</span>
                <span className="text-[#A1A1AA]">via {meta.keyLabel}</span>
                {meta.rotatedCount > 0 && <Badge tone="amber">{meta.rotatedCount} rotations</Badge>}
                {meta.cached && <Badge tone="emerald">Cached today</Badge>}
                {meta.rotationNote && !meta.cached && (
                  <p className="w-full text-[10px] leading-snug text-[#4F46E5]">{meta.rotationNote}</p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-[#71717A]">
                No AI key connected yet. We're using built-in outfit advice.
              </p>
            )}
            <p className="mt-2 truncate font-mono text-[10px] text-[#A1A1AA]">Saved for today as: {cacheKey}</p>
            <button
              type="button"
              onClick={onForceRefresh}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] px-2.5 py-1.5 text-[11px] font-semibold text-[#4F46E5] hover:bg-[#EEF2FF]"
            >
              <RotateCcw size={12} /> Get a fresh version now
            </button>
          </div>

          <KeyEditor
            keys={keys}
            onChange={onChange}
            onPing={onPing}
            onSimulateRateLimit={onSimulateRateLimit}
          />

          <div className="mt-4 overflow-hidden rounded-xl border border-[#E4E4E7] bg-white">
            <button
              type="button"
              onClick={() => setShowAdvanced((value) => !value)}
              aria-expanded={showAdvanced}
              className="flex min-h-11 w-full items-center gap-2 px-4 py-3 text-left text-[12px] font-semibold text-[#3F3F46] hover:bg-[#FAFAFA]"
            >
              <ChevronDown size={14} className={`shrink-0 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              Advanced: run a model on your computer
              <Badge tone="neutral" className="ml-auto">Optional</Badge>
            </button>
            {showAdvanced && (
              <div className="space-y-3 border-t border-[#F4F4F5] px-4 py-4">
                <p className="text-[11px] leading-relaxed text-[#52525B]">
                  Already using Ollama on your computer? Add it here — no account or key needed.
                  Everything stays on your machine.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-[10px] font-semibold text-[#71717A]">
                    Address
                    <input
                      value={localBaseUrl}
                      onChange={(event) => setLocalBaseUrl(event.target.value)}
                      placeholder="http://localhost:11434"
                      className="mt-1 w-full rounded-lg border border-[#E4E4E7] px-2.5 py-2 font-mono text-[11px] font-normal text-[#3F3F46]"
                    />
                  </label>
                  <label className="text-[10px] font-semibold text-[#71717A]">
                    Model name
                    <input
                      value={localModel}
                      onChange={(event) => setLocalModel(event.target.value)}
                      placeholder="llama3.1"
                      className="mt-1 w-full rounded-lg border border-[#E4E4E7] px-2.5 py-2 font-mono text-[11px] font-normal text-[#3F3F46]"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={addLocalModel}
                  disabled={!localModel.trim()}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[#4F46E5] px-3 py-2 text-[11px] font-semibold text-[#4F46E5] hover:bg-[#EEF2FF] disabled:opacity-40"
                >
                  <Plus size={12} /> Add this local model
                </button>
                <p className="flex items-start gap-1.5 rounded-lg bg-[#FFFBEB] px-3 py-2 text-[10px] leading-relaxed text-[#92400E]">
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F4F4F5] bg-[#FCFCFD] px-5 py-3.5 sm:px-7">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#71717A]">
              <Check size={13} className="text-[#10B981]" /> {keys.length} key{keys.length === 1 ? '' : 's'} saved locally
            </span>
            <button
              type="button"
              onClick={onResetDemo}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[#FECDD3] px-2.5 py-2 text-[11px] font-semibold text-[#BE123C] hover:bg-[#FFF1F2] sm:min-h-9"
            >
              <Trash2 size={12} /> Start fresh (clear saved keys)
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg bg-[#09090B] px-3.5 py-2 text-[11px] font-semibold text-white hover:bg-[#27272A] sm:min-h-9"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
