import { ExternalLink, Lock, ShieldCheck } from 'lucide-react'
import { PROVIDERS } from '../lib/mockDigest.js'

export default function ProviderGuides() {
  const guides = PROVIDERS.filter((provider) => provider.id !== 'ollama')

  return (
    <div>
      <p className="text-[0.875rem] leading-relaxed text-[var(--muted)]">
        Pick one provider to start. Each has a free tier — no credit card needed. Copy the key it gives
        you and paste it into the box below.
      </p>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        {guides.map((provider) => (
          <div key={provider.id} className="border-t border-[var(--line)] pt-4">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--ink)] text-[0.75rem] font-bold text-white">
                {provider.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[0.875rem] font-semibold text-[var(--ink)]">{provider.name}</p>
                <p className="text-[0.75rem] text-[var(--faint)]">{provider.note}</p>
              </div>
            </div>
            <ol className="mt-3 space-y-1.5">
              {provider.steps.map((step, index) => (
                <li key={step} className="flex gap-1.5 text-[0.75rem] leading-snug text-[var(--muted)]">
                  <span className="tnum font-semibold text-[var(--faint)]">{index + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
            <a
              href={provider.link}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex min-h-12 items-center gap-1 text-[0.875rem] font-semibold text-[var(--accent)] hover:underline"
            >
              {provider.linkLabel} <ExternalLink size={10} />
            </a>
          </div>
        ))}
      </div>

      <div className="metadata mt-5 space-y-1.5 border-t border-[var(--line)] pt-4">
        <p className="flex items-start gap-1.5">
          <Lock size={11} className="mt-0.5 shrink-0 text-[var(--accent)]" />
          Your keys stay in this browser's localStorage. They are never sent to a Briefr server — there
          isn't one.
        </p>
        <p className="flex items-start gap-1.5">
          <ShieldCheck size={11} className="mt-0.5 shrink-0 text-[var(--accent)]" />
          Free tiers are great for a morning briefing, but they can have usage limits and privacy
          trade-offs. Avoid pasting sensitive information into prompts.
        </p>
      </div>
    </div>
  )
}
