import { ExternalLink, Lock, ShieldCheck } from 'lucide-react'
import { PROVIDERS } from '../lib/mockDigest.js'

export default function ProviderGuides() {
  const guides = PROVIDERS.filter((provider) => provider.id !== 'ollama')

  return (
    <div>
      <p className="text-[12px] leading-relaxed text-[#52525B]">
        Pick one provider to start. Each has a free tier — no credit card needed. Copy the key it gives
        you and paste it into the box below.
      </p>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        {guides.map((provider) => (
          <div key={provider.id} className="rounded-xl border border-[#E4E4E7] bg-[#FCFCFD] p-3.5">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-[#09090B] text-[10px] font-bold text-white">
                {provider.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-[#09090B]">{provider.name}</p>
                <p className="text-[10px] text-[#A1A1AA]">{provider.note}</p>
              </div>
            </div>
            <ol className="mt-3 space-y-1.5">
              {provider.steps.map((step, index) => (
                <li key={step} className="flex gap-1.5 text-[10px] leading-snug text-[#71717A]">
                  <span className="tnum font-semibold text-[#A1A1AA]">{index + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
            <a
              href={provider.link}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#4F46E5] hover:underline"
            >
              {provider.linkLabel} <ExternalLink size={10} />
            </a>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-1.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2.5 text-[10px] leading-snug text-[#71717A]">
        <p className="flex items-start gap-1.5">
          <Lock size={11} className="mt-0.5 shrink-0 text-[#4F46E5]" />
          Your keys stay in this browser's localStorage. They are never sent to a Briefr server — there
          isn't one.
        </p>
        <p className="flex items-start gap-1.5">
          <ShieldCheck size={11} className="mt-0.5 shrink-0 text-[#4F46E5]" />
          Free tiers are great for a morning briefing, but they can have usage limits and privacy
          trade-offs. Avoid pasting sensitive information into prompts.
        </p>
      </div>
    </div>
  )
}
