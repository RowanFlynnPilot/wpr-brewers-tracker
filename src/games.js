// Derivations over division schedules (the same feed the race chart uses). Pure functions — no fetching.
import { TEAM_ID } from './config.js'

// A team's completed games in date order, each flagged won/lost with the score + opponent.
function finals(dates, teamId) {
  const out = []
  dates.forEach((day) =>
    day.games.forEach((g) => {
      if (g.status.detailedState !== 'Final') return
      const home = g.teams.home.team.id === teamId
      const me = home ? g.teams.home : g.teams.away
      const opp = home ? g.teams.away : g.teams.home
      if (me.score == null || opp.score == null) return
      out.push({ date: day.date, won: me.score > opp.score, me: me.score, opp: opp.score, oppName: opp.team.name.replace('Milwaukee ', ''), home })
    })
  )
  return out
}

// Map of teamId -> last N win/loss booleans (oldest → newest), for the standings sparklines.
export function recentForm(schedules, n = 10) {
  const map = {}
  schedules.forEach(({ id, dates }) => { map[id] = finals(dates, id).slice(-n).map((g) => g.won) })
  return map
}

// The home team's most recent completed game, summarized for the pulse recap line.
export function lastFinalGame(schedules) {
  const mine = schedules.find((s) => s.id === TEAM_ID)
  if (!mine) return null
  const fs = finals(mine.dates, TEAM_ID)
  return fs.length ? fs[fs.length - 1] : null
}
