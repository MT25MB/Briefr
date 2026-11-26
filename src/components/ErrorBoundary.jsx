import React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Card } from './ui.jsx'

function GlobalFallback({ onReset }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#E4E4E7] bg-white p-6 text-center shadow-sm">
        <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-[#FFFBEB] text-[#B45309]">
          <AlertTriangle size={18} />
        </span>
        <h1 className="mt-4 text-[18px] font-semibold tracking-tight text-[#09090B]">
          Briefr hit a snag.
        </h1>
        <p className="mt-2 text-[12px] leading-relaxed text-[#71717A]">
          Your saved settings and keys are still in this browser. Try loading the morning view again.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[#4F46E5] px-4 text-[12px] font-semibold text-white hover:bg-[#4338CA]"
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
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#FFFBEB] text-[#B45309]">
          <AlertTriangle size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-[#09090B]">{title} couldn't load</p>
          <p className="mt-1 text-[11px] leading-snug text-[#71717A]">
            The rest of your morning is still here. Try this card again.
          </p>
          <button
            type="button"
            onClick={onReset}
            className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E4E4E7] px-2.5 text-[10px] font-semibold text-[#4F46E5] hover:bg-[#EEF2FF]"
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
