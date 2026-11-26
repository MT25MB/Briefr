// A short, quiet tone paired with warning toasts. Optional: the aria-live
// announcement is always present, even when audio is unavailable or muted.
let context

export function playAlertTone() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    context = context || new AudioContextClass()
    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(620, now)
    oscillator.frequency.exponentialRampToValueAtTime(480, now + 0.12)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.2)
  } catch {
    // Audio is a courtesy, never a requirement.
  }
}
