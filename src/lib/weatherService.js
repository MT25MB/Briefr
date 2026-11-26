// Open-Meteo: free, no API key. All browser-side, no Briefr server.
const GEOCODE_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast'

const FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation_probability',
  'precipitation',
  'snowfall',
  'weather_code',
  'wind_speed_10m',
].join(',')

const WEATHER_CODES = [
  { codes: [0], label: 'Clear sky', kind: 'sun' },
  { codes: [1, 2], label: 'Partly cloudy', kind: 'cloudSun' },
  { codes: [3], label: 'Overcast', kind: 'cloud' },
  { codes: [45, 48], label: 'Fog', kind: 'cloud' },
  { codes: [51, 53, 55, 56, 57], label: 'Drizzle', kind: 'rain' },
  { codes: [61, 63, 65, 66, 67], label: 'Rain', kind: 'rain' },
  { codes: [71, 73, 75, 77], label: 'Snow', kind: 'snow' },
  { codes: [80, 81, 82], label: 'Rain showers', kind: 'rain' },
  { codes: [85, 86], label: 'Snow showers', kind: 'snow' },
  { codes: [95, 96, 99], label: 'Thunderstorms', kind: 'storm' },
]

export function weatherInfo(code) {
  return WEATHER_CODES.find((entry) => entry.codes.includes(code)) ?? { label: 'Unsettled', kind: 'cloud' }
}

export async function geocodeLocation(query) {
  const name = String(query ?? '').trim()
  if (!name) return []
  const params = new URLSearchParams({ name, count: '5', language: 'en', format: 'json' })
  const response = await fetch(`${GEOCODE_ENDPOINT}?${params}`)
  if (!response.ok) throw new Error(`Location lookup failed (${response.status})`)
  const data = await response.json()
  return (data.results ?? []).map((result) => ({
    name: result.name,
    region: result.admin1 ?? '',
    country: result.country ?? '',
    lat: result.latitude,
    lon: result.longitude,
    label: [result.name, result.admin1, result.country].filter(Boolean).join(', '),
  }))
}

export async function fetchHourlyWeather(lat, lon, timezone = 'auto') {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone,
    current: FIELDS,
    hourly: FIELDS,
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    forecast_days: '2',
  })
  const response = await fetch(`${FORECAST_ENDPOINT}?${params}`)
  if (!response.ok) throw new Error(`Forecast request failed (${response.status})`)
  return response.json()
}

const round = (value, digits = 0) => {
  const factor = 10 ** digits
  return Math.round((Number(value) || 0) * factor) / factor
}

function hourLabel(iso) {
  const hour = Number(String(iso).slice(11, 13))
  const suffix = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12} ${suffix}`
}

function bucketFor(iso) {
  const hour = Number(String(iso).slice(11, 13))
  if (hour >= 5 && hour <= 11) return 'morning'
  if (hour >= 12 && hour <= 17) return 'afternoon'
  return 'evening'
}

const WINDOWS = [
  { key: 'morning', label: 'Morning', timeWindow: '5 AM – 11 AM' },
  { key: 'afternoon', label: 'Afternoon', timeWindow: '11 AM – 5 PM' },
  { key: 'evening', label: 'Evening', timeWindow: '5 PM – 5 AM' },
]

function windowStats(hours, fallback) {
  const source = hours.length ? hours : fallback
  const temps = source.map((hour) => hour.temp)
  const feels = source.map((hour) => hour.feelsLike)
  const codes = source.map((hour) => hour.code)
  const worstCode = codes.reduce((worst, code) => (code > worst ? code : worst), 0)
  return {
    tempMin: Math.min(...temps),
    tempMax: Math.max(...temps),
    feelsMin: Math.min(...feels),
    feelsMax: Math.max(...feels),
    precipMax: Math.max(...source.map((hour) => hour.precip)),
    precipitation: round(source.reduce((sum, hour) => sum + hour.precipitation, 0), 2),
    snowfall: round(source.reduce((sum, hour) => sum + hour.snowfall, 0), 2),
    windMax: Math.max(...source.map((hour) => hour.wind)),
    condition: weatherInfo(worstCode).label,
    icon: weatherInfo(worstCode).kind,
    hours: hours.length,
  }
}

// Turns an Open-Meteo payload into 24 scannable hours and 3 reasoning windows.
export function normalizeForecast(data, place = {}) {
  const current = data.current ?? {}
  const hourlyRaw = data.hourly ?? {}
  const startIndex = Math.max(0, hourlyRaw.time?.indexOf(current.time) ?? 0)
  const next24 = (hourlyRaw.time ?? []).slice(startIndex, startIndex + 24)

  const hourly = next24.map((time, index) => {
    const i = startIndex + index
    const code = hourlyRaw.weather_code?.[i] ?? 0
    return {
      time: hourLabel(time),
      iso: time,
      temp: round(hourlyRaw.temperature_2m?.[i]),
      feelsLike: round(hourlyRaw.apparent_temperature?.[i]),
      precip: round(hourlyRaw.precipitation_probability?.[i]),
      precipitation: round(hourlyRaw.precipitation?.[i], 2),
      snowfall: round(hourlyRaw.snowfall?.[i], 2),
      wind: round(hourlyRaw.wind_speed_10m?.[i]),
      code,
      condition: weatherInfo(code).label,
      icon: weatherInfo(code).kind,
    }
  })

  const buckets = { morning: [], afternoon: [], evening: [] }
  hourly.forEach((hour) => buckets[bucketFor(hour.iso)].push(hour))

  const windows = WINDOWS.map((window) => ({
    ...window,
    ...windowStats(buckets[window.key], hourly),
  }))

  const currentCode = current.weather_code ?? 0
  const temps = hourly.map((hour) => hour.temp)

  return {
    locationLabel: place.label ?? 'Your location',
    timezone: data.timezone ?? 'auto',
    updatedAt: hourLabel(current.time),
    current: {
      temp: round(current.temperature_2m),
      feelsLike: round(current.apparent_temperature),
      precip: round(current.precipitation_probability),
      precipitation: round(current.precipitation, 2),
      snowfall: round(current.snowfall, 2),
      wind: round(current.wind_speed_10m),
      code: currentCode,
      condition: weatherInfo(currentCode).label,
      icon: weatherInfo(currentCode).kind,
    },
    high: Math.max(round(current.temperature_2m), ...temps),
    low: Math.min(round(current.temperature_2m), ...temps),
    hourly,
    windows,
  }
}

// Compact, unit-labelled input for the wardrobe prompt.
export function summarizeWeather(weather) {
  return {
    location: weather.locationLabel,
    updatedAt: weather.updatedAt,
    timezone: weather.timezone,
    current: weather.current,
    highF: weather.high,
    lowF: weather.low,
    timeWindows: weather.windows.map((window) => ({
      name: window.label,
      range: window.timeWindow,
      tempMinF: window.tempMin,
      tempMaxF: window.tempMax,
      feelsLikeMinF: window.feelsMin,
      feelsLikeMaxF: window.feelsMax,
      peakPrecipitationChance: window.precipMax,
      precipitationIn: window.precipitation,
      snowfallIn: window.snowfall,
      maxWindMph: window.windMax,
      condition: window.condition,
    })),
    nextHours: weather.hourly.map((hour) => ({
      time: hour.time,
      tempF: hour.temp,
      feelsLikeF: hour.feelsLike,
      precipitationChance: hour.precip,
      precipitationIn: hour.precipitation,
      snowfallIn: hour.snowfall,
      condition: hour.condition,
    })),
  }
}
