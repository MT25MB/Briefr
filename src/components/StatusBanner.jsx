import { Info } from 'lucide-react'

// A calm, non-blocking note. It never covers the briefing or forces an action.
export default function StatusBanner({ state = 'quiet', title, detail, onManage, onRetry }) {
  if (state === 'quiet' || !title) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--warning-soft)] text-[var(--warning)]">
        <Info size={15} aria-hidden="true" />
      </span>
      <p className="text-[0.875rem] font-semibold text-[var(--ink)]">{title}</p>
      {detail && <p className="metadata w-full sm:flex-1">{detail}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="quiet-button min-h-10">
          Try again
        </button>
      )}
      {onManage && (
        <button
          type="button"
          onClick={onManage}
          className="inline-flex min-h-10 items-center text-[0.875rem] font-semibold text-[var(--accent)] hover:underline"
        >
          Key settings
        </button>
      )}
    </div>
  )
}
