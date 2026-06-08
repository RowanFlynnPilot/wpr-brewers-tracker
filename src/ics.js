// Build an iCalendar (.ics) feed of the Brewers' remaining regular-season games — client-side,
// from the MLB schedule. Importable into Apple/Google/Outlook calendars.
import { TEAM_ID } from './config.js'

const pad = (n) => String(n).padStart(2, '0')
const toICS = (iso) => {
  const d = new Date(iso)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
}
const esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')

export function buildICS(games, nowISO) {
  const stamp = toICS(nowISO)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wausau Pilot & Review//Brewers Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Milwaukee Brewers',
  ]
  games.forEach((g) => {
    if (g.gameType !== 'R' || !g.gameDate) return
    const home = g.teams.home.team.id === TEAM_ID
    const opp = (home ? g.teams.away : g.teams.home).team.name
    const start = toICS(g.gameDate)
    const end = toICS(new Date(new Date(g.gameDate).getTime() + 3 * 3600 * 1000).toISOString())
    const summary = home ? `Brewers vs ${opp}` : `Brewers @ ${opp}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${g.gamePk}@wpr-brewers-tracker`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${esc(summary)}`,
      `LOCATION:${esc(g.venue?.name || '')}`,
      'END:VEVENT'
    )
  })
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
