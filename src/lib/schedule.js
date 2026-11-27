// Pure helpers for turning normalized calendar events into a readable morning.

export function eventStart(event) {
  return event?.startTime ? new Date(event.startTime) : null
}

export function eventEnd(event) {
  return event?.endTime ? new Date(event.endTime) : null
}

export function formatTime(date) {
  if (!date || Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function formatCountdown(event, now = new Date()) {
  const start = eventStart(event)
  if (!start) return ''
  const minutes = Math.max(0, Math.ceil((start.getTime() - now.getTime()) / 60_000))
  if (minutes === 0) return 'now'
  if (minutes < 60) return `in ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `in ${hours} hr${rest ? ` ${rest} min` : ''}`
}

export function timeRange(event) {
  if (event?.isAllDay) return 'All day'
  const start = eventStart(event)
  const end = eventEnd(event)
  if (!start || Number.isNaN(start.getTime())) return ''
  if (!end || Number.isNaN(end.getTime())) return formatTime(start)
  return `${formatTime(start)} – ${formatTime(end)}`
}

// Friction is computed once, on the timed sequence only. All-day items never
// participate so a birthday reminder cannot create a fake commute warning.
export function gapNote(event, previous) {
  const start = eventStart(event)
  const previousEnd = eventEnd(previous)
  if (!start || !previousEnd || event.isAllDay || previous.isAllDay) return ''
  const gapMinutes = Math.round((start.getTime() - previousEnd.getTime()) / 60_000)
  const changedPlace = Boolean(previous.location && event.location && previous.location !== event.location)

  if (gapMinutes < 0) return `Overlaps ${previous.title}`
  if (gapMinutes < 20) {
    if (changedPlace) return `Tight switch · ${gapMinutes} min to ${event.location}`
    if (gapMinutes <= 10) return `Back-to-back with ${previous.title}`
    return `Only ${gapMinutes} min between events`
  }
  return ''
}

export function prepareSchedule(events = [], now = new Date()) {
  const allDay = events.filter((event) => event?.isAllDay)
  const timed = events
    .filter((event) => event && !event.isAllDay && eventStart(event) && !Number.isNaN(eventStart(event).getTime()))
    .sort((a, b) => eventStart(a) - eventStart(b))

  const friction = {}
  timed.forEach((event, index) => {
    if (index === 0) return
    const note = gapNote(event, timed[index - 1])
    if (note) friction[event.id] = note
  })

  const nowMs = now.getTime()
  const current = timed.find((event) => {
    const end = eventEnd(event)
    return eventStart(event).getTime() <= nowMs && (!end || end.getTime() >= nowMs)
  }) ?? null
  const upcoming = timed.find((event) => eventStart(event).getTime() > nowMs) ?? null

  return {
    allDay,
    timed,
    friction,
    current,
    upcoming,
    upNext: upcoming ?? current,
    isUpNextCurrent: !upcoming && Boolean(current),
  }
}
