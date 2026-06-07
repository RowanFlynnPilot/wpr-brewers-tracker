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

// Score + describe each "this day in history" game, best first. Surfaces the fun angle:
// no-hitter > walk-off > comeback > extra innings > shutout/blowout > win > loss.
export function rankThisDay(games) {
  const scored = games.map(({ year, game }) => {
    const home = game.teams.home.team.id === TEAM_ID
    const meSide = home ? 'home' : 'away'
    const oppSide = home ? 'away' : 'home'
    const me = game.teams[meSide].score
    const opp = game.teams[oppSide].score
    const oppName = (home ? game.teams.away : game.teams.home).team.name.replace('Milwaukee ', '')
    const ls = game.linescore || {}
    const innings = ls.innings || []
    const oppHits = ls.teams?.[oppSide]?.hits
    const scheduled = ls.scheduledInnings || 9
    const extra = (ls.currentInning || scheduled) > scheduled
    const won = me > opp
    const margin = Math.abs(me - opp)

    // Walk through innings to find the largest deficit faced (for comebacks) and a walk-off.
    let meCum = 0, oppCum = 0, maxDef = 0, mePrev = 0, oppPrev = 0
    innings.forEach((inn, idx) => {
      if (idx === innings.length - 1) { mePrev = meCum; oppPrev = oppCum }
      meCum += inn[meSide]?.runs || 0
      oppCum += inn[oppSide]?.runs || 0
      if (oppCum - meCum > maxDef) maxDef = oppCum - meCum
    })
    const lastInning = innings[innings.length - 1]
    const walkoff = home && won && (lastInning?.home?.runs || 0) > 0 && mePrev <= oppPrev

    let rank, text
    if (won && oppHits === 0) { rank = 7; text = `No-hit the ${oppName}, ${me}–${opp}.` }
    else if (walkoff) { rank = 6; text = `Walked off the ${oppName} ${me}–${opp}${extra ? ` in ${ls.currentInning} innings` : ''}.` }
    else if (won && maxDef >= 3) { rank = 5; text = `Rallied from ${maxDef} runs down to beat the ${oppName} ${me}–${opp}.` }
    else if (won && extra) { rank = 4; text = `Outlasted the ${oppName} ${me}–${opp} in ${ls.currentInning} innings.` }
    else if (won && opp === 0) { rank = 3; text = `Blanked the ${oppName} ${me}–${opp}.` }
    else if (won && margin >= 7) { rank = 3; text = `Routed the ${oppName} ${me}–${opp}.` }
    else if (won) { rank = 1; text = `Beat the ${oppName} ${me}–${opp}.` }
    else { rank = 0; text = `Fell to the ${oppName} ${opp}–${me}.` }

    return { year, me, opp, oppName, won, rank, margin, maxDef, text }
  })
  scored.sort((a, b) => b.rank - a.rank || b.maxDef - a.maxDef || b.margin - a.margin || b.year - a.year)
  return scored
}
