import { AlertTriangle, Headphones, KeyRound, Loader2, Pause, Play, RefreshCw, Sparkles, Square, Volume2, VolumeX } from 'lucide-react'
import BrandMark from './BrandMark.jsx'
import { Segmented } from './ui.jsx'
import { TONES } from '../lib/storage.js'

const ACTION_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40 sm:min-h-9'

const TONE_LABELS = {
  'Quick Bullets': 'Short',
  Friendly: 'Friendly',
  Direct: 'Direct',
}

function AudioControls({ state, onPlay, onPause, onResume, onStop, mobile = false }) {
  if (state === 'unsupported') {
    return (
      <button
        type="button"
        disabled
        title="This browser can't read the briefing out loud."
        className={`${ACTION_BUTTON} cursor-not-allowed border-[#E4E4E7] bg-[#FAFAFA] text-[#A1A1AA]`}
      >
        <VolumeX size={15} /> No audio
      </button>
    )
  }

  const button = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40 sm:min-h-9'

  return (
    <div className={`inline-flex items-center gap-1 ${mobile ? '' : 'rounded-xl border border-[#E4E4E7] bg-white p-1'}`}>
      {state === 'idle' ? (
        <button type="button" onClick={onPlay} aria-label="Play the briefing out loud" className={`${button} bg-[#4F46E5] text-white hover:bg-[#4338CA]`}>
          <Play size={14} /> Listen
        </button>
      ) : (
        <>
          {state === 'playing' ? (
            <button type="button" onClick={onPause} aria-label="Pause the briefing" className={`${button} bg-[#EEF2FF] text-[#4F46E5] hover:bg-[#E0E7FF]`}>
              <Pause size={14} /> Pause
            </button>
          ) : (
            <button type="button" onClick={onResume} aria-label="Keep listening" className={`${button} bg-[#4F46E5] text-white hover:bg-[#4338CA]`}>
              <Play size={14} /> Resume
            </button>
          )}
          <button type="button" onClick={onStop} aria-label="Stop the briefing" className={`${button} text-[#71717A] hover:bg-[#F4F4F5]`}>
            <Square size={13} /> Stop
          </button>
        </>
      )}
      {state === 'playing' && !mobile && <Volume2 size={13} className="mr-1 animate-pulse text-[#4F46E5]" />}
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
  rateLimitSim,
  onToggleRateLimit,
  onOpenSettings,
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#E4E4E7] bg-white/85 backdrop-blur-xl">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[20px] font-bold tracking-[-0.04em] text-[#09090B]">Briefr</span>
                <span className="hidden rounded-md bg-[#F4F4F5] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#71717A] sm:inline">
                  New
                </span>
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-[#71717A]">
                <Sparkles size={11} className="shrink-0 text-[#4F46E5]" />
                <span className="font-medium text-[#3F3F46]">{dateLabel}</span>
                <span className="text-[#D4D4D8]">•</span>
                <span className="truncate">{headline}</span>
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Segmented
              options={TONES.map((value) => ({ value, label: TONE_LABELS[value] ?? value }))}
              value={tone}
              onChange={onToneChange}
              size="sm"
              className="mr-1"
            />

            <AudioControls state={audioState} onPlay={onPlay} onPause={onPause} onResume={onResume} onStop={onStop} />

            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className={`${ACTION_BUTTON} border-[#E4E4E7] bg-white text-[#3F3F46] hover:border-[#D4D4D8] hover:bg-[#FAFAFA] disabled:opacity-60`}
            >
              {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              <span className="hidden sm:inline">{refreshing ? 'Getting it ready' : "Today's briefing"}</span>
              <span className="sm:hidden">{refreshing ? 'Working' : 'Get briefing'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleRateLimit}
              title="Pretend a provider is too busy, then watch Briefr switch to a backup."
              className={`${ACTION_BUTTON} px-2.5 text-[11px] ${
                rateLimitSim
                  ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]'
                  : 'border-dashed border-[#D4D4D8] bg-white text-[#A1A1AA] hover:text-[#52525B]'
              }`}
            >
              <AlertTriangle size={14} />
              <span className="hidden md:inline">Try a rate limit</span>
              <span
                className={`relative h-3.5 w-6 rounded-full transition-colors ${
                  rateLimitSim ? 'bg-[#F59E0B]' : 'bg-[#E4E4E7]'
                }`}
              >
                <span
                  className={`absolute top-0.5 size-2.5 rounded-full bg-white shadow transition-all ${
                    rateLimitSim ? 'left-3' : 'left-0.5'
                  }`}
                />
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className={`${ACTION_BUTTON} border-[#09090B] bg-[#09090B] text-white hover:bg-[#27272A]`}
            >
              <KeyRound size={15} />
              <span className="hidden sm:inline">Keys & settings</span>
              <span className="sm:hidden">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {audioState !== 'unsupported' && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E4E4E7] bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
              <Headphones size={13} className="text-[#4F46E5]" /> Listen to your day
            </span>
            <div className="ml-auto">
              <AudioControls
                mobile
                state={audioState}
                onPlay={onPlay}
                onPause={onPause}
                onResume={onResume}
                onStop={onStop}
              />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
