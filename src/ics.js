// Build an iCalendar (.ics) feed of the Brewers' remaining games (regular season + postseason) —
// client-side, from the MLB schedule. Importable into Apple/Google/Outlook calendars.
import { TEAM_ID, SPONSORS, SITE_URL } from './config.js'
import { isRegularOrPost, postseasonLabel } from './games.js'

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
    if (!isRegularOrPost(g) || !g.gameDate) return
    const home = g.teams.home.team.id === TEAM_ID
    const opp = (home ? g.teams.away : g.teams.home).team.name
    const start = toICS(g.gameDate)
    const end = toICS(new Date(new Date(g.gameDate).getTime() + 3 * 3600 * 1000).toISOString())
    // Postseason: "NLDS Game 4 (if necessary): Brewers @ San Diego Padres". The UID is the gamePk,
    // so re-importing later updates these events rather than duplicating them.
    const round = postseasonLabel(g)
    const summary = `${round ? `${round}${g.ifNecessary === 'Y' ? ' (if necessary)' : ''}: ` : ''}${home ? `Brewers vs ${opp}` : `Brewers @ ${opp}`}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${g.gamePk}@wpr-brewers-tracker`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${esc(summary)}`,
      `LOCATION:${esc(g.venue?.name || '')}`,
      // A sponsor credit that lives inside the reader's calendar for the rest of the season.
      `DESCRIPTION:${esc(`Live Brewers tracker from Wausau Pilot & Review${SPONSORS.header ? `, presented by ${SPONSORS.header.name}` : ''}: ${SITE_URL}`)}`,
      // 30-minute heads-up so imported games actually nudge the reader at game time.
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:First pitch in 30 minutes',
      'TRIGGER:-PT30M',
      'END:VALARM',
      'END:VEVENT'
    )
  })
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
