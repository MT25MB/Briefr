export function Card({ className = '', children }) {
  return (
    <section className={`bg-[var(--surface)] ${className}`}>
      {children}
    </section>
  )
}

export function CardHeader({ title, action }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 px-6 pb-2 pt-6">
      <h2 className="section-title min-w-0">{title}</h2>
      {action && <div className="flex shrink-0 items-center gap-3">{action}</div>}
    </div>
  )
}

export function Segmented({ options, value, onChange, size = 'md', className = '' }) {
  return (
    <div className={`inline-flex items-center ${className}`}>
      {options.map((item) => {
        const option = typeof item === 'object' ? item.value : item
        const label = typeof item === 'object' ? item.label : item
        const active = value === option
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={active}
            className={`min-h-12 border-b-2 px-3 font-semibold ${
              size === 'sm' ? 'text-[0.8125rem]' : 'text-[0.9375rem]'
            } ${
              active
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
