import { useEffect, useState } from 'react'
import { CheckCircle2, Database, RefreshCw, Settings2, Sparkles } from 'lucide-react'
import { Badge } from './ui.jsx'
import { getKeyStatus } from '../lib/llmRotator.js'

export default function RotationStatusBanner({ meta, keys, onManage }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const counts = keys.reduce(
    (acc, key) => {
      acc[getKeyStatus(key, now)] += 1
      return acc
    },
    { ready: 0, cooldown: 0, daily: 0, invalid: 0 },
  )
  const nextCooldown = Math.min(
    ...keys
      .filter((key) => getKeyStatus(key, now) === 'cooldown')
      .map((key) => Math.max(1, Math.ceil((key.cooldownUntil - now) / 1000))),
  )

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#E4E4E7] bg-white px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#4F46E5]">
        {meta?.cached ? <Database size={15} /> : meta ? <RefreshCw size={15} /> : <Sparkles size={15} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-[#09090B]">
          {meta ? `${meta.provider} · ${meta.model}` : 'Built-in outfit rules'}
        </p>
        <p className="truncate text-[10px] text-[#A1A1AA]">
          {meta
            ? `Made with ${meta.keyLabel}${meta.cached ? " · saved earlier today" : ' · fresh'}${
                meta.rotatedCount ? ` · ${meta.rotatedCount} rotation${meta.rotatedCount === 1 ? '' : 's'}` : ''
              }`
            : 'Add a free AI key for more personal tips — the weather works without one.'}
        </p>
        {meta?.rotationNote && !meta.cached && (
          <p className="mt-1 flex items-start gap-1.5 text-[10px] leading-snug text-[#4F46E5]">
            <CheckCircle2 size={11} className="mt-0.5 shrink-0" /> {meta.rotationNote}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {meta?.rotationNote && !meta.cached && <Badge tone="indigo">Backup used</Badge>}
        <Badge tone={counts.ready ? 'emerald' : 'neutral'}>{counts.ready} ready to go</Badge>
        {counts.cooldown > 0 && (
          <Badge tone="amber">
            {counts.cooldown} resting{Number.isFinite(nextCooldown) ? ` · ${nextCooldown}s` : ''}
          </Badge>
        )}
        {counts.daily > 0 && <Badge tone="rose">{counts.daily} used up today</Badge>}
        {counts.invalid > 0 && <Badge tone="rose">{counts.invalid} need a check</Badge>}
        <button
          type="button"
          onClick={onManage}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] px-2.5 py-1.5 text-[11px] font-semibold text-[#3F3F46] hover:bg-[#FAFAFA]"
        >
          <Settings2 size={12} /> Key settings
        </button>
      </div>
    </div>
  )
}
