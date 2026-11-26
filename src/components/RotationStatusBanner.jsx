import { useEffect, useState } from 'react'
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

  const source = meta ? `${meta.provider}${meta.model ? ` · ${meta.model}` : ''}` : 'Built-in outfit rules'
  const details = [
    meta ? `${meta.keyLabel}${meta.cached ? ' · saved earlier' : ' · fresh'}` : null,
    meta?.rotationNote && !meta.cached ? meta.rotationNote : null,
    counts.ready ? `${counts.ready} ready` : null,
    counts.cooldown ? `${counts.cooldown} resting${Number.isFinite(nextCooldown) ? ` · ${nextCooldown}s` : ''}` : null,
    counts.daily ? `${counts.daily} used up today` : null,
    counts.invalid ? `${counts.invalid} need a check` : null,
  ].filter(Boolean)

  return (
    <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <p className="text-[0.875rem] font-semibold text-[var(--ink)]">{source}</p>
      <button
        type="button"
        onClick={onManage}
        className="ml-auto inline-flex min-h-12 items-center text-[0.875rem] font-semibold text-[var(--accent)] hover:underline"
      >
        Key settings
      </button>
      {details.length > 0 && (
        <p className="metadata tnum w-full truncate sm:flex-1 sm:w-auto">
          {details.join(' · ')}
        </p>
      )}
    </div>
  )
}
