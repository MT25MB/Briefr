export function Card({ className = '', children }) {
  return (
    <section
      className={`rounded-2xl border border-[#E4E4E7] bg-white shadow-[0_1px_2px_rgba(9,9,11,0.03)] ${className}`}
    >
      {children}
    </section>
  )
}

export function CardHeader({ icon: Icon, eyebrow, title, action }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#F4F4F5] px-5 py-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
            <Icon size={17} strokeWidth={2} />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A1A1AA]">
              {eyebrow}
            </p>
          )}
          <h2 className="truncate text-[15px] font-semibold tracking-tight text-[#09090B]">{title}</h2>
        </div>
      </div>
      {action}
    </div>
  )
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'bg-[#F4F4F5] text-[#52525B] ring-[#E4E4E7]',
    indigo: 'bg-[#EEF2FF] text-[#4F46E5] ring-[#C7D2FE]',
    amber: 'bg-[#FFFBEB] text-[#B45309] ring-[#FDE68A]',
    emerald: 'bg-[#ECFDF5] text-[#047857] ring-[#A7F3D0]',
    rose: 'bg-[#FFF1F2] text-[#BE123C] ring-[#FECDD3]',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export function Segmented({ options, value, onChange, size = 'md', className = '' }) {
  return (
    <div
      className={`inline-flex items-center rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-1 ${className}`}
    >
      {options.map((item) => {
        const option = typeof item === 'object' ? item.value : item
        const label = typeof item === 'object' ? item.label : item
        const active = value === option
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40 ${
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
            } ${
              active
                ? 'bg-white text-[#09090B] shadow-[0_1px_2px_rgba(9,9,11,0.08)] ring-1 ring-[#E4E4E7]'
                : 'text-[#71717A] hover:text-[#09090B]'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
