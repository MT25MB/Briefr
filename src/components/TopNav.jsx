import { Loader2 } from 'lucide-react'
import BrandMark from './BrandMark.jsx'
import { Segmented } from './ui.jsx'
import { TONES } from '../lib/storage.js'

const ACTION = 'inline-flex min-h-12 items-center justify-center rounded-lg px-3 text-[0.875rem] font-semibold'
const QUIET = `${ACTION} text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]`

const TONE_LABELS = {
  'Quick Bullets': 'Short',
  Friendly: 'Friendly',
  Direct: 'Direct',
}

function AudioControls({ state, onPlay, onPause, onResume, onStop, mobile = false }) {
  if (state === 'unsupported') {
    return (
      <button type="button" disabled title="This browser can't read the briefing out loud." className={`${QUIET} cursor-not-allowed opacity-60`}>
        No audio
      </button>
    )
  }

  return (
    <div className={`inline-flex items-center gap-1 ${mobile ? '' : 'ml-2'}`}>
      {state === 'idle' ? (
        <button type="button" onClick={onPlay} aria-label="Listen to today's briefing" className={`${ACTION} bg-[var(--accent-action)] text-white hover:bg-[var(--accent-action-hover)]`}>
          Listen
        </button>
      ) : (
        <>
          {state === 'playing' ? (
            <button type="button" onClick={onPause} aria-label="Pause the briefing" className={QUIET}>Pause</button>
          ) : (
            <button type="button" onClick={onResume} aria-label="Resume the briefing" className={`${ACTION} bg-[var(--accent-action)] text-white hover:bg-[var(--accent-action-hover)]`}>Resume</button>
          )}
          <button type="button" onClick={onStop} aria-label="Stop the briefing" className={QUIET}>Stop</button>
        </>
      )}
    </div>
  )
}

export default function TopNav({
  dateLabel,
  headline,
  tone,
  onToneChange,
  audioState,
  onPlay,
  onPause,
  onResume,
  onStop,
  onRefresh,
  refreshing,
  onOpenSettings,
  account,
  onOpenAccount,
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <div className="min-w-0">
              <span className="font-display text-[1.5rem] font-semibold leading-none tracking-[-0.04em] text-[var(--ink)]">Briefr</span>
              <p className="metadata mt-1 flex flex-wrap items-center gap-x-2">
                <span>{dateLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{headline}</span>
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-x-1 gap-y-2">
            <Segmented
              options={TONES.map((value) => ({ value, label: TONE_LABELS[value] ?? value }))}
              value={tone}
              onChange={onToneChange}
              size="sm"
              className="mr-2"
            />

            <AudioControls state={audioState} onPlay={onPlay} onPause={onPause} onResume={onResume} onStop={onStop} />

            <button type="button" onClick={onRefresh} disabled={refreshing} className={QUIET}>
              {refreshing && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              <span>{refreshing ? 'Working' : "Today's briefing"}</span>
            </button>

            <button type="button" onClick={onOpenSettings} className={QUIET}>
              <span className="hidden md:inline">Keys & settings</span>
              <span className="md:hidden">Keys</span>
            </button>

            <button
              type="button"
              onClick={onOpenAccount}
              className={QUIET}
              title={account ? `Signed in as ${account.email}` : 'Create an account or sign in'}
            >
              <span className="hidden max-w-[130px] truncate lg:inline">{account ? account.email : 'Sign in'}</span>
              <span className="lg:hidden">{account ? 'Account' : 'Sign in'}</span>
            </button>
          </div>
        </div>
      </div>

      {audioState !== 'unsupported' && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--surface)] px-4 py-2 lg:hidden">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <span className="text-[0.75rem] font-bold uppercase tracking-wider text-[var(--faint)]">Listen to your day</span>
            <div className="ml-auto">
              <AudioControls mobile state={audioState} onPlay={onPlay} onPause={onPause} onResume={onResume} onStop={onStop} />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
