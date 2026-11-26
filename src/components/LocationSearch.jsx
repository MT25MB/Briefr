import { useEffect, useState } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'
import { geocodeLocation } from '../lib/weatherService.js'

export default function LocationSearch({ id = 'location', value, onChange }) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setQuery(value), [value])

  useEffect(() => {
    const text = query.trim()
    if (text.length < 2) {
      setResults([])
      setLoading(false)
      return undefined
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const places = await geocodeLocation(text)
        if (cancelled) return
        setResults(places.slice(0, 5))
        setOpen(true)
      } catch {
        if (cancelled) return
        setResults([])
        setError('Search is unavailable — you can still type a city or ZIP.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  const select = (place) => {
    onChange(place.label)
    setQuery(place.label)
    setResults([])
    setOpen(false)
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) window.setTimeout(() => setOpen(false), 120)
      }}
    >
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
        <input
          id={id}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false)
            if (event.key === 'Enter' && results.length) {
              event.preventDefault()
              select(results[0])
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          placeholder="Start typing a city or ZIP"
          className="w-full rounded-lg border border-[var(--line)] py-2 pl-9 pr-9 text-[0.875rem] focus:border-[var(--accent-line)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        {loading && <Loader2 size={14} className="absolute right-3 top-1/2 animate-spin text-[var(--faint)]" />}
      </div>

      {open && (
        <div
          role="listbox"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] "
        >
          {results.length ? (
            results.map((place) => (
              <button
                key={`${place.name}-${place.region}-${place.lat}`}
                type="button"
                role="option"
                aria-selected={value === place.label}
                onClick={() => select(place)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[0.8125rem] hover:bg-[var(--accent-soft)]"
              >
                <MapPin size={12} className="shrink-0 text-[var(--accent)]" />
                <span className="min-w-0 flex-1 truncate text-[var(--ink-2)]">{place.label}</span>
                <span className="tnum shrink-0 text-[0.75rem] text-[var(--faint)]">
                  {place.lat.toFixed(2)}, {place.lon.toFixed(2)}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-3 text-[0.8125rem] text-[var(--faint)]">
              {error || (loading ? 'Looking up places…' : 'No matches yet — keep typing or use your own text.')}
            </p>
          )}
        </div>
      )}

      <p className="mt-1.5 text-[0.75rem] text-[var(--faint)]">
        Pick a suggestion for the best forecast, or just type your own city or ZIP.
      </p>
    </div>
  )
}
