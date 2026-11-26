// Plain-language script for the browser's built-in speech synthesis.
function spokenStories(stories) {
  return (stories ?? [])
    .slice(0, 3)
    .map((story) => `${story.title}. ${story.summary ?? ''}`.trim())
    .join(' ')
}

export function buildBriefingScript({
  dateLabel = '',
  weather,
  wardrobe,
  newsDigest,
  rawNews = [],
  inbox,
  schedule = [],
}) {
  const local = newsDigest?.local?.length
    ? newsDigest.local
    : rawNews.filter((item) => item.category === 'Local News')
  const important = newsDigest?.important?.length
    ? newsDigest.important
    : rawNews.filter((item) => item.category !== 'Local News')
  const actions = (inbox?.needsAction ?? []).slice(0, 3)
  const events = schedule.slice(0, 3).map((item) => `${item.title} at ${item.time} ${item.meridiem}`)

  const outfit = (wardrobe?.wardrobeTimeline ?? [])
    .slice(0, 3)
    .map((entry) => `${entry.timeWindow}: ${entry.outfit}`)
    .join(' ')

  return [
    `Good morning. Here is your Briefr briefing for ${dateLabel}.`,
    `Weather. ${weather.current.temp} degrees in ${weather.locationLabel}, feeling like ${weather.current.feelsLike}. ${weather.current.condition}. ${wardrobe.precipAlert}`,
    `What to wear. ${outfit}`,
    local.length ? `Local news. ${spokenStories(local)}` : '',
    important.length ? `Important stories. ${spokenStories(important)}` : '',
    actions.length
      ? `Action items. ${actions.map((item) => `${item.sender}: ${item.subject}`).join(' ')}`
      : 'Action items. Nothing needs your reply right now.',
    events.length ? `On your calendar. ${events.join(' ')}` : '',
    "That's your briefing. Have a good day.",
  ]
    .filter(Boolean)
    .join(' ')
}
