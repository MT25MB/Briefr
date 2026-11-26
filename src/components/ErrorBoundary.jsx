import React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Card } from './ui.jsx'

function GlobalFallback({ onReset }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--paper)] px-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center ">
        <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-[var(--warning-soft)] text-[var(--warning)]">
          <AlertTriangle size={18} />
        </span>
        <h1 className="modal-title mt-4">
          Briefr hit a snag.
        </h1>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-[var(--muted)]">
          Your saved settings and keys are still in this browser. Try loading the morning view again.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="mt-4 inline-flex min-h-12 items-center gap-1.5 rounded-lg bg-[var(--accent-action)] px-4 text-[0.875rem] font-semibold text-white hover:bg-[var(--accent-action-hover)]"
        >
          <RotateCcw size={13} /> Reload Briefr
        </button>
      </div>
    </div>
  )
}

function CardFallback({ title, onReset }) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--warning-soft)] text-[var(--warning)]">
          <AlertTriangle size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem] font-semibold text-[var(--ink)]">{title} couldn't load</p>
          <p className="mt-1 text-[0.8125rem] leading-snug text-[var(--muted)]">
            The rest of your morning is still here. Try this card again.
          </p>
          <button
            type="button"
            onClick={onReset}
            className="mt-3 inline-flex min-h-12 items-center gap-1.5 rounded-lg border border-[var(--line)] px-2.5 text-[0.75rem] font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            <RotateCcw size={12} /> Try again
          </button>
        </div>
      </div>
    </Card>
  )
}

export class CardBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidUpdate(previous) {
    if (previous.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <CardFallback
          title={this.props.title ?? 'This card'}
          onReset={() => this.setState({ hasError: false })}
        />
      )
    }
    return this.props.children
  }
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidUpdate(previous) {
    if (previous.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return <GlobalFallback onReset={() => window.location.reload()} />
    }
    return this.props.children
  }
}
