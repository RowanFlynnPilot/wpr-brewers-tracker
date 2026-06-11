// First-pitch forecast via Open-Meteo — free, keyless, CORS-open, fetched straight from the
// browser exactly like the MLB Stats API, so it fits the no-backend architecture. One job:
// the hourly forecast nearest first pitch at American Family Field, mapped to a short label.
const LAT = 43.028 // American Family Field, Milwaukee
const LON = -87.971
const TZ = 'America/Chicago'

// WMO weather codes → reader-friendly labels.
const label = (code) =>
  code === 0 ? 'clear skies' :
  code <= 2 ? 'partly cloudy' :
  code === 3 ? 'overcast' :
  code <= 48 ? 'foggy' :
  code <= 57 ? 'drizzle' :
  code <= 67 ? 'rain' :
  code <= 77 ? 'snow' :
  code <= 82 ? 'rain showers' :
  'thunderstorms'

// Returns { tempF, precipPct, windMph, label } for the hour of first pitch, or null when the
// game is beyond Open-Meteo's 16-day range. Throws on a bad response (fail fast, like api.js).
export async function fetchFirstPitchForecast(gameDateISO) {
  // The ballpark's local hour, formatted to match Open-Meteo's local-time strings.
  const local = new Date(gameDateISO).toLocaleString('sv-SE', { timeZone: TZ }) // "2026-06-11 19:05:00"
  const hour = `${local.slice(0, 10)}T${local.slice(11, 13)}:00`
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    '&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m' +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${encodeURIComponent(TZ)}&forecast_days=16`
  )
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  const { hourly } = await res.json()
  const i = hourly.time.indexOf(hour)
  if (i === -1) return null
  return {
    tempF: Math.round(hourly.temperature_2m[i]),
    precipPct: hourly.precipitation_probability[i],
    windMph: Math.round(hourly.wind_speed_10m[i]),
    label: label(hourly.weather_code[i]),
  }
}
